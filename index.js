import 'dotenv/config'
import mongoose from 'mongoose'
// import cluster from 'cluster'
import mqemitter from 'mqemitter-mongodb'
import aedesPersistenceMongoDB from 'aedes-persistence-mongodb'

const { AEDES_NAME, AEDES_PORT, AEDES_USERNAME, AEDES_PASSWORD, MONGODB_DATABASE, MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_HOST, MONGODB_PORT, MONGODB_MAX_CONNECT } = process.env

const mongodbUri = `mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?retryWrites=true&w=majority`

const connect = async () => mongoose.createConnection(
  mongodbUri,

  {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    serverSelectionTimeoutMS: MONGODB_MAX_CONNECT
  }
)

const startServer = async () => {
  const db = await connect()

  const aedes = require('aedes')({
    // id: 'BROKER_' + cluster.Worker().id,
    id: `${AEDES_NAME}`,
    persistence: aedesPersistenceMongoDB({
      db,
      ttl: {
        packets: 300, // Number of seconds
        subscriptions: 300
      }
    }),
    mq: mqemitter({
      db
    })
  })

  const server = require('net').createServer(aedes.handle)

  server.listen(AEDES_PORT, function () {
    console.log('Aedes listening on port:', AEDES_PORT)
    aedes.publish({ topic: 'aedes/hello', payload: "I'm broker " + aedes.id })
  })

  aedes.authenticate = function (client, username, password, callback) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m authenticating username: ' + AEDES_USERNAME)

    if (username === AEDES_USERNAME && password.toString() === AEDES_PASSWORD) {
      callback(null, true)
    } else {
      const error = new Error('Auth error')
      error.returnCode = 4
      callback(error)
    }
  }

  aedes.on('subscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m subscribed to topics: ' + subscriptions.map(s => s.topic).join('\n'), 'from broker', aedes.id)
  })

  aedes.on('unsubscribe', function (subscriptions, client) {
    console.log('MQTT client \x1b[32m' + (client ? client.id : client) + '\x1b[0m unsubscribed to topics: ' + subscriptions.join('\n'), 'from broker', aedes.id)
  })

  // fired when a client connects
  aedes.on('client', function (client) {
    console.log('Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a client disconnects
  aedes.on('clientDisconnect', function (client) {
    console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
  })

  // fired when a message is published
  aedes.on('publish', async function (packet, client) {
    console.log('Client \x1b[31m' + (client ? client.id : 'BROKER_' + aedes.id) + '\x1b[0m has published', packet.payload.toString(), 'on', packet.topic, 'to broker', aedes.id)
  })
}

startServer()
