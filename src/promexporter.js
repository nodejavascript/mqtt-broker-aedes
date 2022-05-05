import express from 'express'
import client from 'prom-client'
const { PROM_EXPORTER_PORT } = process.env

const app = express()

const { Counter, register } = client

const collectDefaultMetrics = client.collectDefaultMetrics

const prefix = 'mea_'

collectDefaultMetrics({ prefix })

const counters = []

export const exportEvent = ({ name = 'heartbeat' }) => {
  const counterIndex = counters.findIndex(i => i.name === name)

  if (counterIndex >= 0) {
    counters[counterIndex].instance.inc(1)
  } else {
    const newCounter = {
      name,
      instance: new Counter({
        name,
        help: `${name} Help`
      })
    }
    newCounter.instance.inc(1)
    counters.push(newCounter)
  }

  console.log('counters', counters)
}

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen({ port: PROM_EXPORTER_PORT })

console.log(`prom-client is running on port ${PROM_EXPORTER_PORT} /metrics`)
