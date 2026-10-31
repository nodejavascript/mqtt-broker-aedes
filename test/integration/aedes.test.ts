import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Aedes } from 'aedes'
import { buildBrokerOptions, returnAedes } from '../../src/aedes'
import { readConfig } from '../../src/config'

const scratch: string[] = []
const brokers: Aedes[] = []

function tempDb (): string {
  const dir = mkdtempSync(join(tmpdir(), 'aedes-unit-'))
  scratch.push(dir)
  return dir
}

afterEach(async () => {
  for (const broker of brokers.splice(0)) {
    await new Promise<void>(resolve => broker.close(() => resolve()))
  }
  for (const dir of scratch.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('buildBrokerOptions', () => {
  it('uses the configured broker id', () => {
    const options = buildBrokerOptions(
      readConfig({ AEDES_BROKER_NAME: 'named-broker', AEDES_DB_PATH: tempDb() })
    )
    expect(options.id).toBe('named-broker')
  })

  it('leaves the id undefined when none is configured, so Aedes generates one', () => {
    const options = buildBrokerOptions(readConfig({ AEDES_DB_PATH: tempDb() }))
    expect(options.id).toBeUndefined()
  })

  it('builds a persistence layer and a message queue', () => {
    const options = buildBrokerOptions(readConfig({ AEDES_DB_PATH: tempDb() }))

    expect(options.persistence).toBeDefined()
    expect(options.mq).toBeDefined()
    expect(typeof (options.mq as { emit?: unknown }).emit).toBe('function')
  })

  it('gives the message queue the configured concurrency', () => {
    const options = buildBrokerOptions(
      readConfig({ AEDES_DB_PATH: tempDb(), AEDES_CONCURRENCY: '7' })
    )

    // mqemitter 7.x stores the value as `concurrency`; its bundled types call it `concurrent`.
    expect((options.mq as { concurrency?: number }).concurrency).toBe(7)
  })
})

describe('returnAedes', () => {
  it('returns a live broker that carries the configured id', async () => {
    const broker = await returnAedes(
      readConfig({ AEDES_BROKER_NAME: 'unit-broker', AEDES_DB_PATH: tempDb() })
    )
    brokers.push(broker)

    expect(broker.id).toBe('unit-broker')
    expect(broker.closed).toBe(false)
    expect(broker.connectedClients).toBe(0)
  })

  it('generates an id when none is configured', async () => {
    const broker = await returnAedes(readConfig({ AEDES_DB_PATH: tempDb() }))
    brokers.push(broker)

    expect(typeof broker.id).toBe('string')
    expect(broker.id.length).toBeGreaterThan(0)
  })

  it('has finished listening, which a bare `new Aedes()` would not have', async () => {
    const broker = await returnAedes(readConfig({ AEDES_DB_PATH: tempDb() }))
    brokers.push(broker)

    expect(typeof broker.handle).toBe('function')
  })

  it('delivers a message between its own subscriber and publisher', async () => {
    const broker = await returnAedes(readConfig({ AEDES_DB_PATH: tempDb() }))
    brokers.push(broker)

    const received = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a message')), 5000)

      broker.subscribe(
        'in/process',
        (packet, done) => {
          clearTimeout(timer)
          done()
          resolve(packet.payload.toString())
        },
        // aedes 1.x calls this with an error, though its own types declare no arguments
        ((err?: Error | null) => {
          if (err) {
            clearTimeout(timer)
            reject(err)
            return
          }

          broker.publish(
            {
              cmd: 'publish',
              topic: 'in/process',
              payload: Buffer.from('straight through'),
              qos: 0,
              dup: false,
              retain: false
            },
            () => {}
          )
        }) as () => void
      )
    })

    expect(received).toBe('straight through')
  })

  it('closes and reports itself closed', async () => {
    const broker = await returnAedes(readConfig({ AEDES_DB_PATH: tempDb() }))

    await new Promise<void>(resolve => broker.close(() => resolve()))

    expect(broker.closed).toBe(true)
  })
})
