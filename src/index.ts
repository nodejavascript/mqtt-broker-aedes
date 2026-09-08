import 'dotenv/config'
import net from 'net'
import Aedes from 'aedes'
import type { AuthenticateError, Client } from 'aedes'
import { returnAedes } from './aedes'
import { clearStdout } from './readline'
import { handleEvent } from './events'

export interface StartedBroker {
  broker: Aedes
  server: net.Server
  port: number
  close: () => Promise<void>
}

export async function startBroker (portOverride?: number): Promise<StartedBroker> {
  const { AEDES_PORT, AEDES_USERNAME, AEDES_PASSWORD } = process.env

  const broker = await returnAedes()
  const server = net.createServer(broker.handle)
  const requestedPort = portOverride ?? Number(AEDES_PORT ?? 1883)

  broker.authenticate = (client, username, password, done) => {
    const usernameMatches = username === AEDES_USERNAME
    const passwordMatches = password?.toString() === AEDES_PASSWORD

    if (usernameMatches && passwordMatches) {
      done(null, true)
    } else {
      const error = Object.assign(new Error('Auth error'), {
        returnCode: 4 // MQTT CONNACK: bad username or password
      }) as AuthenticateError
      done(error, null)
    }
  }

  // Client lifecycle events
  broker.on('client', (client: Client) => {
    handleEvent(broker, { event: { name: 'client' }, client })
  })
  broker.on('clientDisconnect', (client: Client) => {
    handleEvent(broker, { event: { name: 'clientDisconnect' }, client })
  })

  // Packet events (client is null on broker-originated publishes)
  broker.on('subscribe', (subscriptions, client) => {
    handleEvent(broker, { event: { name: 'subscribe' }, args: subscriptions, client })
  })
  broker.on('unsubscribe', (unsubscriptions, client) => {
    handleEvent(broker, { event: { name: 'unsubscribe' }, args: unsubscriptions, client })
  })
  broker.on('publish', (packet, client) => {
    handleEvent(broker, { event: { name: 'publish' }, args: packet, client })
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err)
    server.once('error', onError)
    server.listen(requestedPort, () => {
      server.removeListener('error', onError)
      resolve()
    })
  })

  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : requestedPort

  clearStdout()
  console.log(`Aedes is running on port ${port}`)

  broker.publish(
    {
      cmd: 'publish',
      topic: '💖 Happy Birthday! ☃️',
      payload: Buffer.from(`${broker.id}, broker I am.`),
      qos: 0,
      dup: false,
      retain: false
    },
    () => {}
  )

  return {
    broker,
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) return reject(err)
          broker.close(() => resolve())
        })
      })
  }
}
