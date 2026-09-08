import type Aedes from 'aedes'
import type { Client } from 'aedes'
import { clearStdout } from './readline'

interface EventMeta {
  name: string
}

interface EventContext {
  event: EventMeta
  args?: any
  client?: Client | null
}

// Helps scroll through stdout
let count = 0

export function handleEvent (broker: Aedes, { event, args, client }: EventContext): void {
  const NODE_ENV = process.env.NODE_ENV
  const DISPLAY_TABLE = process.env.DISPLAY_TABLE

  // Only log when running locally (fixed: original `!NODE_ENV === 'local'`
  // evaluated `(!NODE_ENV) === 'local'`, which is always false).
  if (NODE_ENV !== 'local') return

  count += 1

  // Clears the terminal on every event so the table appears reactive.
  if (DISPLAY_TABLE) clearStdout()

  const display: Record<string, unknown> = {
    event: event.name,
    count,
    now: new Date().toISOString(),
    aedes: `${broker.id}`
  }

  // client won't exist on broker-originated publishes
  if (client) display.client = client.id

  // args can be a `subscriptions` object for `subscribe`, or a packet for `publish`
  if (args && args.topic) display.topic = args.topic

  let payload: string | undefined

  if (event.name === 'publish' && args && args.payload != null) {
    const text = Buffer.from(args.payload).toString()
    display.payloadSize = `${text.length} char(s)`
    payload = text
  }

  if (DISPLAY_TABLE) {
    console.table(display)
  } else {
    let output = `\n\n----${display.event}---- ${display.count}\n${display.now}`
    if (display.client) output += `\nclient: ${display.client}`
    if (payload) output += `\ntopic: ${display.topic}\n${payload}`
    console.log(output)
  }
}
