import type { AedesOptions, AuthenticateError, Client } from 'aedes'

/** aedes 1.x does not export its handler types, so they are read off the options object. */
export type AuthenticateHandler = NonNullable<AedesOptions['authenticate']>

/** MQTT 3.1.1 CONNACK return code 4: bad username or password. */
export const BAD_USERNAME_OR_PASSWORD = 4

export interface Credentials {
  username: Readonly<string | undefined>
  password: Readonly<Buffer | undefined>
}

export interface ExpectedCredentials {
  username: string | undefined
  password: string | undefined
}

/**
 * An unset expected username or password matches an unset one — the rule the broker has always
 * applied, kept so an unconfigured broker stays an open one. Configure both in production.
 */
export function credentialsMatch (provided: Credentials, expected: ExpectedCredentials): boolean {
  return (
    provided.username === expected.username &&
    provided.password?.toString() === expected.password
  )
}

export function createAuthHandler (expected: ExpectedCredentials): AuthenticateHandler {
  return (_client: Client, username, password, done) => {
    if (credentialsMatch({ username, password }, expected)) {
      done(null, true)
      return
    }

    const error = Object.assign(new Error('Auth error'), {
      returnCode: BAD_USERNAME_OR_PASSWORD
    }) as AuthenticateError

    done(error, null)
  }
}
