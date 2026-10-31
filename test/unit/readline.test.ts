import { afterEach, describe, expect, it, vi } from 'vitest'
import readline from 'readline'
import { clearStdout } from '../../src/readline'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clearStdout', () => {
  it('moves the cursor to the top-left and clears the screen', () => {
    const cursorTo = vi.spyOn(readline, 'cursorTo').mockImplementation(() => true)
    const clearScreenDown = vi.spyOn(readline, 'clearScreenDown').mockImplementation(() => true)
    const stdout = { write: () => true } as unknown as NodeJS.WriteStream

    clearStdout(stdout)

    expect(cursorTo).toHaveBeenCalledWith(stdout, 0, 0)
    expect(clearScreenDown).toHaveBeenCalledWith(stdout)
  })

  it('defaults to process.stdout', () => {
    const cursorTo = vi.spyOn(readline, 'cursorTo').mockImplementation(() => true)
    const clearScreenDown = vi.spyOn(readline, 'clearScreenDown').mockImplementation(() => true)

    clearStdout()

    expect(cursorTo).toHaveBeenCalledWith(process.stdout, 0, 0)
    expect(clearScreenDown).toHaveBeenCalledWith(process.stdout)
  })

  it('clears the screen after moving the cursor, never before', () => {
    const order: string[] = []
    vi.spyOn(readline, 'cursorTo').mockImplementation(() => {
      order.push('cursorTo')
      return true
    })
    vi.spyOn(readline, 'clearScreenDown').mockImplementation(() => {
      order.push('clearScreenDown')
      return true
    })

    clearStdout({ write: () => true } as unknown as NodeJS.WriteStream)

    expect(order).toEqual(['cursorTo', 'clearScreenDown'])
  })
})
