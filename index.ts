import { startBroker } from './src'

startBroker()
  .then(({ close }) => {
    const shutdown = (signal: string): void => {
      console.log(`\n${signal} received, closing broker`)
      close()
        .then(() => process.exit(0))
        .catch(err => {
          console.error('Failed to close broker cleanly:', err)
          process.exit(1)
        })
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))
  })
  .catch(err => {
    console.error('Failed to start broker:', err)
    process.exit(1)
  })
