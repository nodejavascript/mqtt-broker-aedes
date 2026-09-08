import { startBroker } from './src'

startBroker().catch(err => {
  console.error('Failed to start broker:', err)
  process.exit(1)
})
