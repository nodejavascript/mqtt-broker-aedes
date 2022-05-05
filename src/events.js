import { exportEvent } from './promexporter'

// helps to scroll through stdout

export const handleEvent = (aedes, { event, args, client }) => {
  const name = args.client || 'heartbeat'

  console.log('args', args)
  exportEvent({ name })
}
