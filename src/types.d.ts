// Ambient declarations for dependencies that do not ship their own types.

declare module 'aedes-persistence-level' {
  const aedesPersistenceLevel: (db: any) => any
  export default aedesPersistenceLevel
}

declare module 'mqemitter' {
  import { EventEmitter } from 'events'

  interface MQEmitterOptions {
    concurrency?: number
    matchEmptyLevels?: boolean
  }

  const mqemitter: (options?: MQEmitterOptions) => EventEmitter
  export default mqemitter
}

declare module 'dotenv/config'
