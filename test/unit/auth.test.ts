import { describe, expect, it, vi } from 'vitest'
import type { Client } from 'aedes'
import {
  BAD_USERNAME_OR_PASSWORD,
  createAuthHandler,
  credentialsMatch
} from '../../src/auth'

const client = { id: 'client-1' } as Client

describe('credentialsMatch', () => {
  it('accepts matching username and password', () => {
    expect(
      credentialsMatch(
        { username: 'user', password: Buffer.from('pass') },
        { username: 'user', password: 'pass' }
      )
    ).toBe(true)
  })

  it('rejects a wrong password', () => {
    expect(
      credentialsMatch(
        { username: 'user', password: Buffer.from('wrong') },
        { username: 'user', password: 'pass' }
      )
    ).toBe(false)
  })

  it('rejects a wrong username', () => {
    expect(
      credentialsMatch(
        { username: 'other', password: Buffer.from('pass') },
        { username: 'user', password: 'pass' }
      )
    ).toBe(false)
  })

  it('rejects a missing password when one is configured', () => {
    expect(
      credentialsMatch({ username: 'user', password: undefined }, { username: 'user', password: 'pass' })
    ).toBe(false)
  })

  it('compares by text, so a UTF-8 password works', () => {
    expect(
      credentialsMatch(
        { username: 'user', password: Buffer.from('pässwörd', 'utf8') },
        { username: 'user', password: 'pässwörd' }
      )
    ).toBe(true)
  })

  // Documented, not endorsed: an unconfigured broker has always been an open one.
  it('accepts an unset username and password when neither is configured', () => {
    expect(
      credentialsMatch(
        { username: undefined, password: undefined },
        { username: undefined, password: undefined }
      )
    ).toBe(true)
  })

  it('rejects an empty-string password against an unset one', () => {
    expect(
      credentialsMatch({ username: undefined, password: Buffer.from('') }, { username: undefined, password: undefined })
    ).toBe(false)
  })
})

describe('createAuthHandler', () => {
  it('calls done with success and no error on a good login', () => {
    const handler = createAuthHandler({ username: 'user', password: 'pass' })
    const done = vi.fn()

    handler(client, 'user', Buffer.from('pass'), done)

    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith(null, true)
  })

  it('rejects with MQTT return code 4 on a bad password', () => {
    const handler = createAuthHandler({ username: 'user', password: 'pass' })
    const done = vi.fn()

    handler(client, 'user', Buffer.from('nope'), done)

    const [error, success] = done.mock.calls[0] as [Error & { returnCode: number }, boolean | null]
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Auth error')
    expect(error.returnCode).toBe(BAD_USERNAME_OR_PASSWORD)
    expect(success).toBeNull()
  })

  it('rejects with MQTT return code 4 on an unknown username', () => {
    const handler = createAuthHandler({ username: 'user', password: 'pass' })
    const done = vi.fn()

    handler(client, 'someone-else', Buffer.from('pass'), done)

    expect(done.mock.calls[0][0]).toMatchObject({ returnCode: 4 })
  })

  it('rejects an anonymous client when a password is configured', () => {
    const handler = createAuthHandler({ username: 'user', password: 'pass' })
    const done = vi.fn()

    handler(client, undefined, undefined, done)

    expect(done.mock.calls[0][0]).toMatchObject({ returnCode: 4 })
  })

  it('lets an anonymous client in when nothing is configured', () => {
    const handler = createAuthHandler({ username: undefined, password: undefined })
    const done = vi.fn()

    handler(client, undefined, undefined, done)

    expect(done).toHaveBeenCalledWith(null, true)
  })

  it('builds a fresh error on every rejection, so callers cannot mutate a shared one', () => {
    const handler = createAuthHandler({ username: 'user', password: 'pass' })
    const first = vi.fn()
    const second = vi.fn()

    handler(client, 'user', Buffer.from('a'), first)
    handler(client, 'user', Buffer.from('b'), second)

    expect(first.mock.calls[0][0]).not.toBe(second.mock.calls[0][0])
  })
})
