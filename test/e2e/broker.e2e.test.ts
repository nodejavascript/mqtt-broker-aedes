import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import mqtt from 'mqtt'
import { startBroker } from '../../src/index'
import type { StartedBroker } from '../../src/index'
import { readConfig } from '../../src/config'

const USERNAME = 'e2e-user'
const PASSWORD = 'e2e-pass'
const BROKER_ID = 'e2e-broker'

let broker: StartedBroker
let dbDir: string
const openClients: mqtt.MqttClient[] = []

beforeAll(async () => {
  dbDir = mkdtempSync(join(tmpdir(), 'mqtt-broker-aedes-'))
  broker = await startBroker({
    port: 0,
    quiet: true,
    config: readConfig({
      AEDES_DB_PATH: dbDir,
      AEDES_USERNAME: USERNAME,
      AEDES_PASSWORD: PASSWORD,
      AEDES_BROKER_NAME: BROKER_ID
    })
  })
})

afterAll(async () => {
  for (const client of openClients.splice(0)) client.end(true)
  await broker.close()
  rmSync(dbDir, { recursive: true, force: true })
})

function connect (password = PASSWORD, username = USERNAME): mqtt.MqttClient {
  const client = mqtt.connect({
    host: '127.0.0.1',
    port: broker.port,
    username,
    password,
    protocolVersion: 4,
    reconnectPeriod: 0,
    connectTimeout: 5000,
    clientId: `e2e-${Math.random().toString(16).slice(2, 10)}`
  })
  openClients.push(client)
  return client
}

function connected (client: mqtt.MqttClient): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for connect')), 5000)
    client.once('connect', () => {
      clearTimeout(timer)
      resolve()
    })
    client.once('error', err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

function connectionError (client: mqtt.MqttClient): Promise<Error & { code?: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for rejection')), 5000)
    client.once('error', err => {
      clearTimeout(timer)
      resolve(err as Error & { code?: number })
    })
    client.once('connect', () => {
      clearTimeout(timer)
      reject(new Error('client unexpectedly connected'))
    })
  })
}

interface Received {
  topic: string
  payload: Buffer
  qos: number
  retain: boolean
}

function onceMessage (client: mqtt.MqttClient, timeout = 5000): Promise<Received> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for a message')), timeout)
    client.once('message', (topic, payload, packet) => {
      clearTimeout(timer)
      resolve({
        topic,
        payload: Buffer.isBuffer(payload) ? payload : Buffer.from(payload),
        qos: packet.qos,
        retain: Boolean(packet.retain)
      })
    })
  })
}

function subscribe (client: mqtt.MqttClient, topic: string, qos: 0 | 1 | 2 = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos }, err => (err ? reject(err) : resolve()))
  })
}

function publish (
  client: mqtt.MqttClient,
  topic: string,
  payload: string | Buffer,
  options: mqtt.IClientPublishOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, options, err => (err ? reject(err) : resolve()))
  })
}

describe('MQTT broker (end-to-end)', () => {
  it('accepts valid credentials', async () => {
    const client = connect()
    await expect(connected(client)).resolves.toBeUndefined()
  })

  it('rejects a client with an incorrect password', async () => {
    const client = connect('wrong-password')
    await expect(connectionError(client)).resolves.toBeInstanceOf(Error)
  })

  it('rejects a client with an unknown username', async () => {
    const client = connect(PASSWORD, 'not-the-user')
    await expect(connectionError(client)).resolves.toBeInstanceOf(Error)
  })

  it('rejects an anonymous client when credentials are configured', async () => {
    const client = mqtt.connect({
      host: '127.0.0.1',
      port: broker.port,
      protocolVersion: 4,
      reconnectPeriod: 0,
      connectTimeout: 5000
    })
    openClients.push(client)

    await expect(connectionError(client)).resolves.toBeInstanceOf(Error)
  })

  it('reports the configured broker id', () => {
    expect(broker.broker.id).toBe(BROKER_ID)
  })

  it('round-trips a QoS 1 message', async () => {
    const client = connect()
    await connected(client)

    const received = onceMessage(client)
    await subscribe(client, 'e2e/hello', 1)
    await publish(client, 'e2e/hello', 'hello from e2e', { qos: 1 })

    const packet = await received
    expect(packet.topic).toBe('e2e/hello')
    expect(packet.payload.toString()).toBe('hello from e2e')
  })

  it('round-trips a QoS 0 message', async () => {
    const client = connect()
    await connected(client)

    const received = onceMessage(client)
    await subscribe(client, 'e2e/qos0')
    await publish(client, 'e2e/qos0', 'fire and forget', { qos: 0 })

    expect((await received).payload.toString()).toBe('fire and forget')
  })

  it('round-trips a QoS 2 message exactly once', async () => {
    const client = connect()
    await connected(client)

    let count = 0
    client.on('message', () => {
      count += 1
    })

    const received = onceMessage(client)
    await subscribe(client, 'e2e/qos2', 2)
    await publish(client, 'e2e/qos2', 'exactly once', { qos: 2 })

    expect((await received).payload.toString()).toBe('exactly once')
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(count).toBe(1)
  })

  it('delivers on a single-level wildcard', async () => {
    const client = connect()
    await connected(client)

    const received = onceMessage(client)
    await subscribe(client, 'e2e/wild/+/temp')
    await publish(client, 'e2e/wild/kitchen/temp', '21')

    expect((await received).topic).toBe('e2e/wild/kitchen/temp')
  })

  it('delivers on a multi-level wildcard', async () => {
    const client = connect()
    await connected(client)

    const received = onceMessage(client)
    await subscribe(client, 'e2e/deep/#')
    await publish(client, 'e2e/deep/a/b/c', 'down here')

    expect((await received).topic).toBe('e2e/deep/a/b/c')
  })

  it('does not deliver to a topic the subscription does not match', async () => {
    const client = connect()
    await connected(client)

    const seen: string[] = []
    client.on('message', topic => seen.push(topic))

    await subscribe(client, 'e2e/match/only')
    await publish(client, 'e2e/elsewhere', 'should not arrive')
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(seen).toEqual([])
  })

  it('delivers a retained message to a later subscriber', async () => {
    const publisher = connect()
    await connected(publisher)
    await publish(publisher, 'e2e/retained', 'kept', { retain: true, qos: 1 })

    // give the broker a moment to store the retained message
    await new Promise(resolve => setTimeout(resolve, 150))

    const subscriber = connect()
    await connected(subscriber)

    const received = onceMessage(subscriber)
    await subscribe(subscriber, 'e2e/retained', 1)

    const packet = await received
    expect(packet.payload.toString()).toBe('kept')
    expect(packet.retain).toBe(true)
  })

  it('clears a retained message when an empty payload is published with retain', async () => {
    const client = connect()
    await connected(client)

    await publish(client, 'e2e/retained-clear', 'set', { retain: true })
    await new Promise(resolve => setTimeout(resolve, 100))
    await publish(client, 'e2e/retained-clear', '', { retain: true })
    await new Promise(resolve => setTimeout(resolve, 100))

    const late = connect()
    await connected(late)

    const seen: string[] = []
    late.on('message', topic => seen.push(topic))
    await subscribe(late, 'e2e/retained-clear')
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(seen).toEqual([])
  })

  it('stops delivery after an unsubscribe', async () => {
    const client = connect()
    await connected(client)

    const seen: string[] = []
    client.on('message', (_topic, payload) => seen.push(payload.toString()))

    await subscribe(client, 'e2e/unsub')
    await publish(client, 'e2e/unsub', 'before')
    await new Promise(resolve => setTimeout(resolve, 150))

    await new Promise<void>((resolve, reject) => {
      client.unsubscribe('e2e/unsub', err => (err ? reject(err) : resolve()))
    })

    await publish(client, 'e2e/unsub', 'after')
    await new Promise(resolve => setTimeout(resolve, 150))

    expect(seen).toEqual(['before'])
  })

  it('fans a message out to every subscriber', async () => {
    const one = connect()
    const two = connect()
    const three = connect()
    await Promise.all([connected(one), connected(two), connected(three)])

    const first = onceMessage(one)
    const second = onceMessage(two)
    const third = onceMessage(three)

    await Promise.all([
      subscribe(one, 'e2e/fanout', 1),
      subscribe(two, 'e2e/fanout', 1),
      subscribe(three, 'e2e/fanout', 1)
    ])

    await publish(one, 'e2e/fanout', 'to everyone', { qos: 1 })

    const payloads = await Promise.all([first, second, third])
    expect(payloads.map(packet => packet.payload.toString())).toEqual([
      'to everyone',
      'to everyone',
      'to everyone'
    ])
  })

  it('round-trips a binary payload byte for byte', async () => {
    const client = connect()
    await connected(client)

    const bytes = Buffer.from([0x00, 0x01, 0x02, 0x7f, 0x80, 0xfe, 0xff])

    const received = onceMessage(client)
    await subscribe(client, 'e2e/binary', 1)
    await publish(client, 'e2e/binary', bytes, { qos: 1 })

    expect(Buffer.compare((await received).payload, bytes)).toBe(0)
  })

  it('delivers an empty payload rather than dropping it', async () => {
    const client = connect()
    await connected(client)

    const received = onceMessage(client)
    await subscribe(client, 'e2e/empty')
    await publish(client, 'e2e/empty', '')

    expect((await received).payload.length).toBe(0)
  })

  it('carries a 64 KiB payload intact', async () => {
    const client = connect()
    await connected(client)

    const big = Buffer.alloc(64 * 1024, 0x41)

    const received = onceMessage(client, 10000)
    await subscribe(client, 'e2e/big', 1)
    await publish(client, 'e2e/big', big, { qos: 1 })

    const packet = await received
    expect(packet.payload.length).toBe(big.length)
    expect(Buffer.compare(packet.payload, big)).toBe(0)
  })

  it('tracks the number of connected clients', async () => {
    const before = broker.broker.connectedClients

    const client = connect()
    await connected(client)

    expect(broker.broker.connectedClients).toBe(before + 1)

    client.end(true)
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(broker.broker.connectedClients).toBe(before)
  })

  it('emits client and clientDisconnect around a session', async () => {
    const events: string[] = []

    const label = (name: string): void => {
      events.push(name)
    }
    broker.broker.once('client', () => label('client'))
    broker.broker.once('clientDisconnect', () => label('clientDisconnect'))

    const client = connect()
    await connected(client)
    client.end(true)
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(events).toEqual(['client', 'clientDisconnect'])
  })
})
