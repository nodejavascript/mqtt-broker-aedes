# mqtt-broker-aedes

A small MQTT broker built on [Aedes](https://github.com/moscajs/aedes), with
LevelDB persistence and an `mqemitter` message bus. Written in **TypeScript**.

## Requirements

- Node.js 18+ (20+ recommended)
- npm

## Setup

```bash
npm install
cp .env.example .env   # then edit the values
```

> **Note:** `.npmrc` sets `legacy-peer-deps=true` to work around an npm 10
> Arborist bug when resolving Vitest's peer set.

## Environment variables

| Variable             | Default     | Description                                  |
| -------------------- | ----------- | -------------------------------------------- |
| `NODE_ENV`           | `local`     | Event logging only runs when set to `local`  |
| `DISPLAY_TABLE`      | (unset)     | `true` renders event log as a live table     |
| `AEDES_PORT`         | `1883`      | Port the broker listens on                   |
| `AEDES_BROKER_NAME`  | `aedesname` | Broker id                                    |
| `AEDES_USERNAME`     | `aedesuser` | Username clients must authenticate with      |
| `AEDES_PASSWORD`     | (empty)     | Password clients must authenticate with      |
| `AEDES_DB_PATH`      | `./mydb`    | LevelDB persistence directory                |

## Scripts

```bash
npm run dev        # run with ts-node + nodemon (auto-reload)
npm run build      # compile TypeScript to ./dist
npm start          # run the compiled output (node dist/index.js)
npm run typecheck  # type-check without emitting
npm test           # run unit + end-to-end tests
npm run test:unit  # unit tests only
npm run test:e2e   # end-to-end tests only (spins up a real broker + MQTT client)
```

## Docker

```bash
docker build . -t mqtt-broker-aedes
docker run --restart always -p 1883:1883 -d --name mqtt-broker-aedes mqtt-broker-aedes
```

The LevelDB store lives at `./mydb` inside the container; mount it as a volume
to persist across container recreation.

## Notes

- Authentication uses a single shared username/password (`aedes.authenticate`).
- If the build fails on a machine with two network connections, check that the
  Docker DNS is pointed at an online connection — npm can fail if it resolves to
  an offline NIC.
