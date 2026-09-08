import 'dotenv/config'
import net from 'net'
import { Aedes, AuthErrorCode, Client } from 'aedes'
import { returnAedes } from './aedes'
import { clearStdout } from './readline'
import { handleEvent } from './events'

const { AEDES_PORT, AEDES_USERNAME, AEDES_PASSWORD } = process.env

const PORT = Number(AEDES_PORT ?? 1883)

export async function startBroker (): Promise<void> {
  const broker = await returnAedes()

  const server = net.createServer(broker.handle)

  server.listen(PORT, () => {
    clearStdout()
    console.log(`Aedes is running on port ${PORT}`)

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
  })

  broker.authenticate = (client, username, password, done) => {
    if (username === AEDES_USERNAME && password.toString() === AEDES_PASSWORD) {
      done(null, true)
    } else {
      const error = new Error('Auth error') as Error & { returnCode: AuthErrorCode }
      error.returnCode = AuthErrorCode.BAD_USERNAME_OR_PASSWORD
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

  // Packet events (no client on broker-originated publishes)
  broker.on('subscribe', (subscriptions, client) => {
    handleEvent(broker, { event: { name: 'subscribe' }, args: subscriptions, client })
  })
  broker.on('unsubscribe', (unsubscriptions, client) => {
    handleEvent(broker, { event: { name: 'unsubscribe' }, args: unsubscriptions, client })
  })
  broker.on('publish', (packet, client) => {
    handleEvent(broker, { event: { name: 'publish' }, args: packet, client })
  })
}
