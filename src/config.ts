import 'dotenv/config'

export const DEFAULT_PORT = 1883
export const DEFAULT_DB_PATH = './mydb'
export const DEFAULT_CONCURRENCY = 500

export interface BrokerConfig {
  /** TCP port the broker listens on. 0 asks the OS for a free one. */
  port: number
  /** Broker id. `undefined` lets Aedes generate one. */
  brokerId: string | undefined
  username: string | undefined
  password: string | undefined
  dbPath: string
  concurrency: number
  /** Event logging is switched on only when this is exactly `local`. */
  nodeEnv: string
  displayTable: boolean
}

/** Anything that looks like a process environment — kept loose so tests can pass a plain object. */
export type EnvSource = Record<string, string | undefined>

export function parsePort (value: string | undefined, fallback = DEFAULT_PORT): number {
  if (value === undefined || value.trim() === '') return fallback

  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError(`AEDES_PORT is not a valid port: "${value}"`)
  }

  return port
}

export function parseConcurrency (value: string | undefined, fallback = DEFAULT_CONCURRENCY): number {
  if (value === undefined || value.trim() === '') return fallback

  const concurrency = Number(value)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(`AEDES_CONCURRENCY is not a positive integer: "${value}"`)
  }

  return concurrency
}

/**
 * `DISPLAY_TABLE=false` used to switch the table ON, because a non-empty string is truthy.
 * Anything other than the explicit words below counts as false.
 */
export function parseBoolean (value: string | undefined): boolean {
  if (value === undefined) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function readConfig (env: EnvSource = process.env): BrokerConfig {
  return {
    port: parsePort(env.AEDES_PORT),
    brokerId: env.AEDES_BROKER_NAME || undefined,
    username: env.AEDES_USERNAME,
    password: env.AEDES_PASSWORD,
    dbPath: env.AEDES_DB_PATH || DEFAULT_DB_PATH,
    concurrency: parseConcurrency(env.AEDES_CONCURRENCY),
    nodeEnv: env.NODE_ENV ?? '',
    displayTable: parseBoolean(env.DISPLAY_TABLE)
  }
}
