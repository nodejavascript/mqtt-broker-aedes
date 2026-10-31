import { afterEach, describe, expect, it, vi } from 'vitest'
import net from 'node:net'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startBroker } from '../../src/index'
import type { StartedBroker } from '../../src/index'
import { readConfig } from '../../src/config'

const started: StartedBroker[] = []
const scratch: string[] = []

function config (overrides: Record<string, string> = {}): ReturnType<typeof readConfig> {
  const dir = mkdtempSync(join(tmpdir(), 'aedes-start-'))
  scratch.push(dir)
  return readConfig({ AEDES_DB_PATH: dir, ...overrides })
}

async function start (options: Parameters<typeof startBroker>[0]): Promise<StartedBroker> {
  const broker = await startBroker(options)
  started.push(broker)
  return broker
}

afterEach(async () => {
  for (const broker of started.splice(0)) await broker.close()
  vi.restoreAllMocks()
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('startBroker', () => {
  it('binds an OS-assigned port when asked for port 0', async () => {
    const broker = await start({ port: 0, quiet: true, config: config() })

    expect(broker.port).toBeGreaterThan(0)
    expect(broker.port).toBeLessThanOrEqual(65535)
  })

  it('still accepts a bare port number, which is how the old signature was called', async () => {
    const broker = await start(0)

    expect(broker.port).toBeGreaterThan(0)
  })

  it('takes the port from the configuration when no override is given', async () => {
    const broker = await start({ port: 0, quiet: true, config: config({ AEDES_PORT: '1883' }) })

    expect(broker.port).toBeGreaterThan(0)
  })

  it('binds to a specific free port when one is given', async () => {
    const probe = net.createServer()
    await new Promise<void>(resolve => probe.listen(0, resolve))
    const address = probe.address()
    const freePort = typeof address === 'object' && address ? address.port : 0
    await new Promise<void>(resolve => probe.close(() => resolve()))

    const broker = await start({ port: freePort, quiet: true, config: config() })

    expect(broker.port).toBe(freePort)
  })

  it('rejects rather than silently listening elsewhere when the port is taken', async () => {
    const blocker = net.createServer()
    await new Promise<void>(resolve => blocker.listen(0, '0.0.0.0', resolve))
    const address = blocker.address()
    const takenPort = typeof address === 'object' && address ? address.port : 0

    try {
      await expect(
        startBroker({ port: takenPort, quiet: true, config: config() })
      ).rejects.toBeInstanceOf(Error)
    } finally {
      await new Promise<void>(resolve => blocker.close(() => resolve()))
    }
  })

  it('says which port it is on unless it is told to be quiet', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const broker = await start({ port: 0, config: config() })

    const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n')
    expect(output).toContain(`Aedes is running on port ${broker.port}`)
  })

  it('prints nothing on startup when quiet', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await start({ port: 0, quiet: true, config: config() })

    expect(logSpy).not.toHaveBeenCalled()
  })

  it('exposes the broker and the server', async () => {
    const broker = await start({ port: 0, quiet: true, config: config() })

    expect(broker.broker).toBeDefined()
    expect(broker.server).toBeInstanceOf(net.Server)
    expect(broker.server.listening).toBe(true)
  })

  it('closes the server and resolves', async () => {
    const broker = await start({ port: 0, quiet: true, config: config() })

    await broker.close()

    expect(broker.server.listening).toBe(false)
    expect(broker.broker.closed).toBe(true)
  })

  it('can be closed twice without rejecting the second time', async () => {
    const broker = await start({ port: 0, quiet: true, config: config() })

    await broker.close()

    await expect(broker.close()).resolves.toBeUndefined()
  })

  it('stops accepting connections once closed', async () => {
    const broker = await start({ port: 0, quiet: true, config: config() })
    const port = broker.port
    await broker.close()

    const reachable = await new Promise<boolean>(resolve => {
      const socket = net.connect({ host: '127.0.0.1', port }, () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => resolve(false))
      socket.setTimeout(1000, () => {
        socket.destroy()
        resolve(false)
      })
    })

    expect(reachable).toBe(false)
  })
})
