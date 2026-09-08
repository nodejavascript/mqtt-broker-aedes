import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleEvent } from '../../src/events'

const fakeBroker = { id: 'broker-1' } as any
const fakeClient = { id: 'client-1' } as any

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NODE_ENV
  delete process.env.DISPLAY_TABLE
})

describe('handleEvent', () => {
  it('does nothing when NODE_ENV is not local', () => {
    process.env.NODE_ENV = 'production'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    expect(logSpy).not.toHaveBeenCalled()
    expect(tableSpy).not.toHaveBeenCalled()
  })

  it('logs a client event with the client id when running locally', () => {
    process.env.NODE_ENV = 'local'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    handleEvent(fakeBroker, { event: { name: 'client' }, client: fakeClient })

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n')
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

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n')
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
})
