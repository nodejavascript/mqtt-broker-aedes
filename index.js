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

// start with array to scale easier
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

// helps to scroll through stdout
let count = 0

const clearStdout = process => {
  const { stdout } = process
  readline.cursorTo(stdout, 0, 0)
  readline.clearScreenDown(stdout)
}

const startServer = async () => {
  const aedes = await returnAedes()
  const server = net.createServer(aedes.handle)

  server.listen(AEDES_PORT, () => {
    clearStdout(process)
    console.log(`AEDES_PORT: ${AEDES_PORT}`)

    aedes.publish({ topic: '💖 Happy Birthday! ☃️', payload: `${aedes.id}, broker I am.` })
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

  events.forEach(event => {
    // decided to line these up so you can clearly see what's curious
    if (event.connection) aedes.on(event.name, client => handleEvent(aedes, { event, client }))
    if (!event.connection) aedes.on(event.name, (args, client) => handleEvent(aedes, { event, args, client }))
  })
}

const handleEvent = (aedes, { event, args, client }) => {
  if (!NODE_ENV === 'local') return

  count += 1

  // clears terminal every event so table appears reactive.
  if (DISPLAY_TABLE) clearStdout(process)

  const display = {
    event: event.name,
    count: count,
    now: (new Date()).toISOString(),
    aedes: `${aedes.id}`
  }

  // client won't exist on aedes.publish()
  if (client) display.client = client.id

  // args can exist as a `subscriptions` object for connection === true, OR as packet object if event is `publish`
  if (args && args.topic) display.topic = args.topic

  let payload

  if (['publish'].includes(event.name)) {
    display.payloadSize = `${args.payload.toString().length} char(s)`
    payload = args.payload.toString()
  }

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
