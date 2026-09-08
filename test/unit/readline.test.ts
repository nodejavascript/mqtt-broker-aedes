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
})
