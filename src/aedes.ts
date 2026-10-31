import 'dotenv/config'
import { Aedes } from 'aedes'
import type { AedesOptions } from 'aedes'
import { Level } from 'level'
import aedesPersistenceLevel from 'aedes-persistence-level'
import mqemitter from 'mqemitter'
import { readConfig } from './config'
import type { BrokerConfig } from './config'

export function buildBrokerOptions (config: BrokerConfig): AedesOptions {
  return {
    id: config.brokerId,
    persistence: aedesPersistenceLevel(new Level(config.dbPath)),
    mq: mqemitter({
      concurrency: config.concurrency,
      matchEmptyLevels: true // [MQTT-4.7.1-3]
    })
  }
}

/**
 * aedes 1.x expects brokers to be created through `createBroker`, which also runs `listen()`.
 * A bare `new Aedes()` skips that and is deprecated.
 */
export async function returnAedes (config: BrokerConfig = readConfig()): Promise<Aedes> {
  return Aedes.createBroker(buildBrokerOptions(config))
}
