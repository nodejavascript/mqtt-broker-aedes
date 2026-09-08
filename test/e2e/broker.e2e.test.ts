import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mqtt from 'mqtt'
import { startBroker } from '../../src/index'
import type { StartedBroker } from '../../src/index'

const USERNAME = 'e2e-user'
const PASSWORD = 'e2e-pass'

let broker: StartedBroker
let dbDir: string

beforeAll(async () => {
  dbDir = mkdtempSync(join(tmpdir(), 'mqtt-broker-aedes-'))
  process.env.AEDES_DB_PATH = dbDir
  process.env.AEDES_USERNAME = USERNAME
  process.env.AEDES_PASSWORD = PASSWORD
  process.env.NODE_ENV = 'production'
  broker = await startBroker(0)
})

afterAll(async () => {
  await broker.close()
  rmSync(dbDir, { recursive: true, force: true })
})

function connect (password = PASSWORD): mqtt.MqttClient {
  return mqtt.connect({
    host: '127.0.0.1',
    port: broker.port,
    username: USERNAME,
    password,
    protocolVersion: 4,
    reconnectPeriod: 0,
    connectTimeout: 5000
  })
}

describe('MQTT broker (end-to-end)', () => {
  it('accepts valid credentials and round-trips a message', async () => {
    const client = connect()

    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve)
      client.once('error', reject)
    })

    const received = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for message')), 5000)

      client.subscribe('e2e/hello', { qos: 1 }, err => {
        if (err) {
          clearTimeout(timer)
          reject(err)
          return
        }
        client.publish('e2e/hello', 'hello from e2e', { qos: 1 })
      })

      client.on('message', (topic, payload) => {
        clearTimeout(timer)
        resolve(`${topic}:${payload.toString()}`)
      })
    })

    await expect(received).resolves.toBe('e2e/hello:hello from e2e')
    client.end(true)
  })

  it('rejects a client with an incorrect password', async () => {
    const client = connect('wrong-password')

    const err = await new Promise<Error>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for auth rejection')), 5000)

      client.once('error', e => {
        clearTimeout(timer)
        resolve(e)
      })
      client.once('connect', () => {
        clearTimeout(timer)
        reject(new Error('client unexpectedly connected with a bad password'))
      })
    })

    expect(err).toBeInstanceOf(Error)
    client.end(true)
  })
})
