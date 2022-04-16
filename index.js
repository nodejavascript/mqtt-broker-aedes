import 'dotenv/config'
import readline from 'readline'
import net from 'net'
import { returnAedes } from './aedes'

const {
  NODE_ENV,
  DISPLAY_TABLE,
  AEDES_PORT,
  AEDES_USERNAME,
  AEDES_PASSWORD
} = process.env

const events = [
  {
    name: 'client',
    connection: true
  },
  {
    name: 'clientDisconnect',
    connection: true
  },
  {
    name: 'subscribe'
  },
  {
    name: 'unsubscribe'
  },
  {
    name: 'publish'
  }
]

let count = 0

const startServer = async () => {
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)

  const aedes = await returnAedes()
  const server = net.createServer(aedes.handle)

  server.listen(AEDES_PORT, () => {
    console.log(`AEDES_PORT: ${AEDES_PORT}`)
    aedes.publish({ topic: 'mqttserver', payload: "I'm broker " + aedes.id })
  })

  aedes.authenticate = (client, username, password, callback) => {
    if (username === AEDES_USERNAME && password.toString() === AEDES_PASSWORD) {
      callback(null, true)
    } else {
      const error = new Error('Auth error')
      error.returnCode = 4
      callback(error)
    }
  }

  events.filter(i => i.connection).forEach(event => aedes.on(event.name, client => handleEvent(aedes, { event, client })))
  events.filter(i => !i.connection).forEach(event => aedes.on(event.name, (args, client) => handleEvent(aedes, { event, args, client })))
}

const handleEvent = (aedes, { event, args, client }) => {
  if (!NODE_ENV === 'local') return

  count += 1

  // clears terminal so table appears reactive
  if (DISPLAY_TABLE) {
    readline.cursorTo(process.stdout, 0, 0)
    readline.clearScreenDown(process.stdout)
  }

  const display = {
    event: event.name,
    count: count,
    now: (new Date()).toISOString(),
    aedes: `${aedes.id}`
  }

  if (client) display.client = client.id

  if (args && args.topic) display.topic = args.topic

  let payload

  if (['publish'].includes(event.name)) {
    display.payloadSize = `${args.payload.toString().length} char(s)`
    // console.log('args.payload', args.payload.toString())
    payload = args.payload.toString()
  }

  if (['subscribe', 'unsubscribe'].includes(event.name.toString())) display.topics = args.map(s => s.topic).length

  DISPLAY_TABLE && console.table(display)

  if (!DISPLAY_TABLE) {
    const { event, count, now, topic, client } = display

    let output = `\n\n----${event}---- ${count}\n${now}`
    if (client) output += `\nclient: ${client}`
    if (payload) output += `\ntopic: ${topic}\n${payload}`

    console.log(output)
  }
}

startServer()

// console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m authenticating username: ' + AEDES_USERNAME + '\n\n')

// aedes.on('subscribe', function (args, client) {
//   handleNoClient({ args, client })
//   console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m subscribed to topics: ' + args.map(s => s.topic).join('\n'), 'from broker', aedes.id)
// })
//
// aedes.on('unsubscribe', function (subscriptions, client) {
//   handleNoClient({ subscriptions, client })
//   console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m unsubscribed to topics: ' + subscriptions.join('\n'), 'from broker', aedes.id)
// })
//
// // fired when a client connects
// aedes.on('client', function (client) {
//   handleNoClient({ client })
//   console.log('Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
// })
//
// aedes.on('clientDisconnect', function (client) {
//   handleNoClient({ client })
//   console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
// })
//
// aedes.on('publish', async function (args, client) {
//   handleNoClient({ args, client })
//   console.log('Client \x1b[31m' + (client ? client.id : 'BROKER_' + aedes.id) + '\x1b[0m has published', args.payload.toString().length, 'on', args.topic, 'to broker', aedes.id)
// })
