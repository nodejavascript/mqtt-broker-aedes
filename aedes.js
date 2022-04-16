import 'dotenv/config'
import mongoose from 'mongoose'
import mqemitter from 'mqemitter-mongodb'
import aedesPersistenceMongoDB from 'aedes-persistence-mongodb'
import aedes from 'aedes'

const {
  AEDES_BROKER_NAME,
  MONGODB_DATABASE,
  MONGODB_USERNAME,
  MONGODB_PASSWORD,
  MONGODB_HOST,
  MONGODB_PORT,
  MONGODB_MAX_CONNECT
} = process.env

export const returnAedes = async () => {
  console.log(`connecting to ${MONGODB_HOST}...`)

  console.time('connected')
  const db = await connect()
  console.timeEnd('connected')

  return aedes({
    /*
      if you want to use cluster,\:
      import cluster from 'cluster'
      replace id with `cluster.Worker().id`
    */

    id: AEDES_BROKER_NAME,
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
}

const connectionString = `mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_DATABASE}?retryWrites=true&w=majority`

const connect = async () => mongoose.createConnection(
  connectionString,
  {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    serverSelectionTimeoutMS: MONGODB_MAX_CONNECT
  }
)
