import 'dotenv/config'
import Aedes from 'aedes'
import { Level } from 'level'
import aedesPersistenceLevel from 'aedes-persistence-level'
import mqemitter from 'mqemitter'

export async function returnAedes (): Promise<Aedes> {
  const { AEDES_BROKER_NAME, AEDES_DB_PATH } = process.env

  return new Aedes({
    id: AEDES_BROKER_NAME,
    persistence: aedesPersistenceLevel(new Level(AEDES_DB_PATH ?? './mydb')),
    mq: mqemitter({
      concurrency: 500,
      matchEmptyLevels: true // [MQTT-4.7.1-3]
    })
  })
}
