import type { Aedes } from 'aedes'
import type { Client } from 'aedes'
import { clearStdout } from './readline'
import { parseBoolean } from './config'

interface EventMeta {
  name: string
}

interface EventArgs {
  topic?: string
  payload?: unknown
}

/** `unsubscribe` hands over plain topic strings; every other packet event hands over an object. */
type EventArgsLike = EventArgs | string

interface EventContext {
  event: EventMeta
  args?: EventArgsLike | EventArgsLike[]
  client?: Client | null
}

export interface EventDisplay {
  event: string
  count: number
  now: string
  aedes: string
  client?: string
  topic?: string
  payloadSize?: string
}

// Helps scroll through stdout
let count = 0

/** The counter is module state, so tests need a way back to a known starting point. */
export function resetEventCount (value = 0): void {
  count = value
}

export function currentEventCount (): number {
  return count
}

export function buildDisplay (
  broker: Pick<Aedes, 'id'>,
  { event, args, client }: EventContext,
  now: string = new Date().toISOString()
): { display: EventDisplay, payload?: string } {
  count += 1

  const display: EventDisplay = {
    event: event.name,
    count,
    now,
    aedes: `${broker.id}`
  }

  // client won't exist on broker-originated publishes
  if (client) display.client = client.id

  // args can be `subscriptions[]` for `subscribe`, a packet for `publish`, or topic strings
  const single: EventArgsLike | undefined = Array.isArray(args) ? args[0] : args
  const packet = single !== null && typeof single === 'object' ? single : undefined

  if (packet?.topic) display.topic = packet.topic

  let payload: string | undefined

  if (event.name === 'publish' && packet?.payload != null) {
    const text = Buffer.from(packet.payload as Buffer).toString()
    display.payloadSize = `${text.length} char(s)`
    payload = text
  }

  return { display, payload }
}

export function handleEvent (broker: Pick<Aedes, 'id'>, context: EventContext): void {
  const NODE_ENV = process.env.NODE_ENV
  const DISPLAY_TABLE = parseBoolean(process.env.DISPLAY_TABLE)

  // Only log when running locally (fixed: original `!NODE_ENV === 'local'`
  // evaluated `(!NODE_ENV) === 'local'`, which is always false).
  if (NODE_ENV !== 'local') return

  const { display, payload } = buildDisplay(broker, context)

  // Clears the terminal on every event so the table appears reactive.
  if (DISPLAY_TABLE) clearStdout()

  if (DISPLAY_TABLE) {
    console.table(display)
  } else {
    let output = `\n\n----${display.event}---- ${display.count}\n${display.now}`
    if (display.client) output += `\nclient: ${display.client}`
    if (payload) output += `\ntopic: ${display.topic}\n${payload}`
    console.log(output)
  }
}
