import 'dotenv/config'
import net from 'net'
import type { Aedes } from 'aedes'
import type { Client } from 'aedes'
import { returnAedes } from './aedes'
import { createAuthHandler } from './auth'
import { readConfig } from './config'
import type { BrokerConfig } from './config'
import { clearStdout } from './readline'
import { handleEvent } from './events'

export interface StartOptions {
  /** Overrides `AEDES_PORT`. 0 asks the OS for a free port. */
  port?: number
  /** Overrides everything read from the environment. */
  config?: BrokerConfig
  /** Announce the port on stdout. Off in tests. */
  quiet?: boolean
}

export interface StartedBroker {
  broker: Aedes
  server: net.Server
  port: number
  close: () => Promise<void>
}

const BIRTHDAY_TOPIC = '💖 Happy Birthday! ☃️'

export async function startBroker (options: number | StartOptions = {}): Promise<StartedBroker> {
  const opts: StartOptions = typeof options === 'number' ? { port: options } : options
  const config = opts.config ?? readConfig()

  const broker = await returnAedes(config)
  const server = net.createServer(broker.handle)
  const requestedPort = opts.port ?? config.port

  broker.authenticate = createAuthHandler({
    username: config.username,
    password: config.password
  })

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

  if (!opts.quiet) {
    clearStdout()
    console.log(`Aedes is running on port ${port}`)
  }

  broker.publish(
    {
      cmd: 'publish',
      topic: BIRTHDAY_TOPIC,
      payload: Buffer.from(`${broker.id}, broker I am.`),
      qos: 0,
      dup: false,
      retain: false
    },
    () => {}
  )

  let closed = false

  return {
    broker,
    server,
    port,
    close: () => {
      if (closed) return Promise.resolve()
      closed = true

      return new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) return reject(err)
          broker.close(() => resolve())
        })
      })
    }
  }
}
