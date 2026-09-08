import 'dotenv/config'
import aedes, { Aedes } from 'aedes'
import { Level } from 'level'
import aedesPersistenceLevel from 'aedes-persistence-level'
import mqemitter from 'mqemitter'

const { AEDES_BROKER_NAME } = process.env

export async function returnAedes (): Promise<Aedes> {
  return aedes({
    id: AEDES_BROKER_NAME,
    persistence: aedesPersistenceLevel(new Level('./mydb')),
    mq: mqemitter({
      concurrency: 500,
      matchEmptyLevels: true // [MQTT-4.7.1-3]
    })
  })
}
