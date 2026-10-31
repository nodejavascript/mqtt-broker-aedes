import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from 'aedes'
import {
  buildDisplay,
  currentEventCount,
  handleEvent,
  resetEventCount
} from '../../src/events'

const fakeBroker = { id: 'broker-1' }
const fakeClient = { id: 'client-1' } as Client

beforeEach(() => {
  resetEventCount()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NODE_ENV
  delete process.env.DISPLAY_TABLE
})

function loggedText (spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n')
}

describe('buildDisplay', () => {
  it('names the event, the broker and a timestamp', () => {
    const { display } = buildDisplay(
      fakeBroker,
      { event: { name: 'client' } },
      '2026-01-01T00:00:00.000Z'
    )

    expect(display).toMatchObject({
      event: 'client',
      count: 1,
      now: '2026-01-01T00:00:00.000Z',
      aedes: 'broker-1'
    })
  })

  it('increases the counter on every call', () => {
    buildDisplay(fakeBroker, { event: { name: 'client' } })
    buildDisplay(fakeBroker, { event: { name: 'client' } })

    expect(currentEventCount()).toBe(2)
    expect(buildDisplay(fakeBroker, { event: { name: 'client' } }).display.count).toBe(3)
  })

  it('can be reset, so a test does not depend on the one before it', () => {
    buildDisplay(fakeBroker, { event: { name: 'client' } })
    resetEventCount(10)

    expect(buildDisplay(fakeBroker, { event: { name: 'client' } }).display.count).toBe(11)
  })

  it('adds the client id when there is a client', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'client' },
      client: fakeClient
    })

    expect(display.client).toBe('client-1')
  })

  it('omits the client for a broker-originated publish', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'a/b', payload: Buffer.from('x') },
      client: null
    })

    expect(display.client).toBeUndefined()
  })

  it('reads the topic off a single packet', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'sensors/one', payload: Buffer.from('1') }
    })

    expect(display.topic).toBe('sensors/one')
  })

  it('reads the topic off the first entry of an array of subscriptions', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'subscribe' },
      args: [{ topic: 'first/topic' }, { topic: 'second/topic' }],
      client: fakeClient
    })

    expect(display.topic).toBe('first/topic')
  })

  it('ignores bare topic strings, which is what unsubscribe delivers', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'unsubscribe' },
      args: ['just/a/string'],
      client: fakeClient
    })

    expect(display.topic).toBeUndefined()
    expect(display.client).toBe('client-1')
  })

  it('measures the payload in characters', () => {
    const { display, payload } = buildDisplay(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'a/b', payload: Buffer.from('abcde') }
    })

    expect(display.payloadSize).toBe('5 char(s)')
    expect(payload).toBe('abcde')
  })

  it('counts characters, not bytes, for multi-byte payloads', () => {
    const { display } = buildDisplay(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'a/b', payload: Buffer.from('ééé', 'utf8') }
    })

    expect(display.payloadSize).toBe('3 char(s)')
  })

  it('reports an empty payload as zero characters', () => {
    const { display, payload } = buildDisplay(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'a/b', payload: Buffer.alloc(0) }
    })

    expect(display.payloadSize).toBe('0 char(s)')
    expect(payload).toBe('')
  })

  it('adds no payload detail for a non-publish event even if one is passed', () => {
    const { display, payload } = buildDisplay(fakeBroker, {
      event: { name: 'client' },
      args: { topic: 'a/b', payload: Buffer.from('ignored') }
    })

    expect(display.payloadSize).toBeUndefined()
    expect(payload).toBeUndefined()
  })

  it('survives a missing args value', () => {
    expect(() => buildDisplay(fakeBroker, { event: { name: 'client' } })).not.toThrow()
  })
})

describe('handleEvent', () => {
  it('does nothing when NODE_ENV is not local', () => {
    process.env.NODE_ENV = 'production'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    expect(logSpy).not.toHaveBeenCalled()
    expect(tableSpy).not.toHaveBeenCalled()
    expect(currentEventCount()).toBe(0)
  })

  it('does nothing when NODE_ENV is unset', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    expect(logSpy).not.toHaveBeenCalled()
  })

  it('logs a client event with the client id when running locally', () => {
    process.env.NODE_ENV = 'local'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    const output = loggedText(logSpy)
    expect(output).toContain('----client----')
    expect(output).toContain('client: client-1')
  })

  it('logs the topic and payload for publish events', () => {
    process.env.NODE_ENV = 'local'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleEvent(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'hello/world', payload: Buffer.from('hello payload') },
      client: null
    })

    const output = loggedText(logSpy)
    expect(output).toContain('----publish----')
    expect(output).toContain('topic: hello/world')
    expect(output).toContain('hello payload')
  })

  it('renders a table when DISPLAY_TABLE is set', () => {
    process.env.NODE_ENV = 'local'
    process.env.DISPLAY_TABLE = 'true'
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})

    handleEvent(fakeBroker, {
      event: { name: 'publish' },
      args: { topic: 'table/topic', payload: Buffer.from('abcde') },
      client: null
    })

    expect(tableSpy).toHaveBeenCalledTimes(1)
    expect(tableSpy.mock.calls[0][0]).toMatchObject({
      event: 'publish',
      topic: 'table/topic',
      payloadSize: '5 char(s)',
      aedes: 'broker-1'
    })
  })

  // The original tested `if (DISPLAY_TABLE)`, so the literal string "false" switched the table on.
  it('does not render a table when DISPLAY_TABLE is the word "false"', () => {
    process.env.NODE_ENV = 'local'
    process.env.DISPLAY_TABLE = 'false'
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    expect(tableSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalled()
  })
})
