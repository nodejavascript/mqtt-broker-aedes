import readline from 'readline'

export function clearStdout (stdout: NodeJS.WriteStream = process.stdout): void {
  readline.cursorTo(stdout, 0, 0)
  readline.clearScreenDown(stdout)
}
