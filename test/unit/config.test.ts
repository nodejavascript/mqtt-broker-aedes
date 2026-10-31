import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_DB_PATH,
  DEFAULT_PORT,
  parseBoolean,
  parseConcurrency,
  parsePort,
  readConfig
} from '../../src/config'

describe('parsePort', () => {
  it('falls back to the default when the variable is missing', () => {
    expect(parsePort(undefined)).toBe(DEFAULT_PORT)
  })

  it('falls back when the variable is blank', () => {
    expect(parsePort('   ')).toBe(DEFAULT_PORT)
  })

  it('accepts 0, which asks the OS for a free port', () => {
    expect(parsePort('0')).toBe(0)
  })

  it('accepts the top of the port range', () => {
    expect(parsePort('65535')).toBe(65535)
  })

  it('rejects a port above 65535', () => {
    expect(() => parsePort('65536')).toThrow(RangeError)
  })

  it('rejects a negative port', () => {
    expect(() => parsePort('-1')).toThrow(RangeError)
  })

  it('rejects a fractional port', () => {
    expect(() => parsePort('80.5')).toThrow(RangeError)
  })

  it('rejects something that is not a number at all', () => {
    expect(() => parsePort('mqtt')).toThrow(RangeError)
  })

  it('honours an explicit fallback', () => {
    expect(parsePort(undefined, 1234)).toBe(1234)
  })
})

describe('parseConcurrency', () => {
  it('falls back to the default when unset', () => {
    expect(parseConcurrency(undefined)).toBe(DEFAULT_CONCURRENCY)
  })

  it('falls back when blank', () => {
    expect(parseConcurrency('')).toBe(DEFAULT_CONCURRENCY)
  })

  it('accepts a positive integer', () => {
    expect(parseConcurrency('250')).toBe(250)
  })

  it('rejects zero, because a broker with no concurrency cannot deliver', () => {
    expect(() => parseConcurrency('0')).toThrow(RangeError)
  })

  it('rejects a negative value', () => {
    expect(() => parseConcurrency('-10')).toThrow(RangeError)
  })

  it('rejects a fraction', () => {
    expect(() => parseConcurrency('1.5')).toThrow(RangeError)
  })

  it('rejects text', () => {
    expect(() => parseConcurrency('many')).toThrow(RangeError)
  })
})

describe('parseBoolean', () => {
  it('is false when the variable is missing', () => {
    expect(parseBoolean(undefined)).toBe(false)
  })

  // The original code tested `if (DISPLAY_TABLE)`, so the string "false" turned the table ON.
  it('treats the word "false" as false', () => {
    expect(parseBoolean('false')).toBe(false)
  })

  it('treats "0" as false', () => {
    expect(parseBoolean('0')).toBe(false)
  })

  it('accepts "true", "1", "yes" and "on" in any case', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'On']) {
      expect(parseBoolean(value), value).toBe(true)
    }
  })

  it('ignores surrounding whitespace', () => {
    expect(parseBoolean('  true  ')).toBe(true)
  })
})

describe('readConfig', () => {
  it('returns defaults for an empty environment', () => {
    expect(readConfig({})).toEqual({
      port: DEFAULT_PORT,
      brokerId: undefined,
      username: undefined,
      password: undefined,
      dbPath: DEFAULT_DB_PATH,
      concurrency: DEFAULT_CONCURRENCY,
      nodeEnv: '',
      displayTable: false
    })
  })

  it('reads every value it is given', () => {
    expect(
      readConfig({
        AEDES_PORT: '1884',
        AEDES_BROKER_NAME: 'broker-x',
        AEDES_USERNAME: 'user',
        AEDES_PASSWORD: 'pass',
        AEDES_DB_PATH: '/tmp/db',
        AEDES_CONCURRENCY: '64',
        NODE_ENV: 'local',
        DISPLAY_TABLE: 'true'
      })
    ).toEqual({
      port: 1884,
      brokerId: 'broker-x',
      username: 'user',
      password: 'pass',
      dbPath: '/tmp/db',
      concurrency: 64,
      nodeEnv: 'local',
      displayTable: true
    })
  })

  it('leaves the broker id undefined so Aedes can generate one', () => {
    expect(readConfig({ AEDES_BROKER_NAME: '' }).brokerId).toBeUndefined()
  })

  it('keeps an empty password as an empty string rather than dropping it', () => {
    expect(readConfig({ AEDES_PASSWORD: '' }).password).toBe('')
  })

  it('throws on a bad port instead of silently listening somewhere else', () => {
    expect(() => readConfig({ AEDES_PORT: 'nope' })).toThrow(RangeError)
  })
})
