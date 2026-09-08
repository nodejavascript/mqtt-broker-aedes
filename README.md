# mqtt-broker-aedes

A small, self-contained MQTT broker built on [Aedes](https://github.com/moscajs/aedes),
with LevelDB persistence and username/password authentication. Written in
TypeScript, with unit + end-to-end tests, and packaged for Docker and Docker Compose.

## Features

- MQTT 3.1.1 / 5.0 via Aedes
- LevelDB persistence — subscriptions and retained/queued messages survive restarts
- Username/password authentication
- Optional live event log in the terminal (`DISPLAY_TABLE=true`)
- TypeScript (strict mode), compiled to CommonJS
- Vitest unit + end-to-end tests
- Multi-stage Docker image (Node 20 Alpine)

## Requirements

- **Docker** + **Docker Compose v2** (recommended), or
- **Node.js 18+** (20+ recommended) and npm for local development

---

## Run without cloning (prebuilt image)

A prebuilt multi-arch image (`linux/amd64` + `linux/arm64`) is published to
[GitHub Container Registry](https://github.com/nodejavascript/mqtt-broker-aedes/pkgs/container/mqtt-broker-aedes)
on every push to `master`.

```yaml
services:
  mqtt-broker:
    image: ghcr.io/nodejavascript/mqtt-broker-aedes:latest
    restart: unless-stopped
    ports:
      - "1883:1883"
    environment:
      NODE_ENV: production
      AEDES_USERNAME: aedesuser
      AEDES_PASSWORD: changeme   # ⚠ change this
      AEDES_DB_PATH: /app/mydb
    volumes:
      - mqtt-data:/app/mydb      # persist the LevelDB store

volumes:
  mqtt-data:
```

Then `docker compose up -d`.

---

## Run with Docker Compose (build from source)

### Standalone (inside this repo)

```bash
docker compose up -d --build
```

Then connect an MQTT client to `mqtt://localhost:1883` using the credentials in
`docker-compose.yml` (defaults `aedesuser` / `changeme` — **change the password**).

### Add to your existing `docker-compose.yml`

```yaml
services:
  mqtt-broker:
    build: ./mqtt-broker-aedes      # path to this repo on disk
    restart: unless-stopped
    ports:
      - "1883:1883"
    environment:
      NODE_ENV: production
      AEDES_PORT: "1883"
      AEDES_BROKER_NAME: aedesname
      AEDES_USERNAME: aedesuser
      AEDES_PASSWORD: changeme      # ⚠ change this
      AEDES_DB_PATH: /app/mydb
    volumes:
      - mqtt-data:/app/mydb         # persist the LevelDB store

volumes:
  mqtt-data:
```

Then `docker compose up -d --build`.

---

## Run with Docker

```bash
docker build . -t mqtt-broker-aedes
docker run --restart unless-stopped \
  -p 1883:1883 \
  -v mqtt-data:/app/mydb \
  -e AEDES_USERNAME=aedesuser \
  -e AEDES_PASSWORD=changeme \
  -d --name mqtt-broker-aedes mqtt-broker-aedes
```

---

## Local development

```bash
npm install
cp .env.example .env   # then edit the values
npm run dev            # ts-node + nodemon, auto-reload
```

> **Note:** `.npmrc` sets `legacy-peer-deps=true` to work around an npm 10
> Arborist bug when resolving Vitest's peer set.

## Environment variables

| Variable            | Default     | Description                                  |
| ------------------- | ----------- | -------------------------------------------- |
| `NODE_ENV`          | `local`     | Event logging only runs when set to `local`  |
| `DISPLAY_TABLE`     | (unset)     | `true` renders the event log as a live table |
| `AEDES_PORT`        | `1883`      | Port the broker listens on                   |
| `AEDES_BROKER_NAME` | `aedesname` | Broker id                                    |
| `AEDES_USERNAME`    | `aedesuser` | Username clients must authenticate with      |
| `AEDES_PASSWORD`    | (empty)     | Password clients must authenticate with      |
| `AEDES_DB_PATH`     | `./mydb`    | LevelDB persistence directory                |

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

## Testing

```bash
npm test
```

- **Unit tests** (`test/unit`) — the event logger and the terminal-clearing helper.
- **End-to-end tests** (`test/e2e`) — boot a real broker on an ephemeral port,
  connect a real MQTT client, verify a message round-trips, and verify a wrong
  password is rejected.

## Project structure

```
.
├── index.ts              # entry point
├── src/
│   ├── aedes.ts          # broker construction (persistence + mq)
│   ├── events.ts         # event logging
│   ├── index.ts          # server + auth + event wiring
│   ├── readline.ts       # terminal helper
│   └── types.d.ts        # ambient types for untyped deps
├── test/
│   ├── unit/
│   └── e2e/
├── Dockerfile            # multi-stage build (Node 20 Alpine)
├── docker-compose.yml
└── tsconfig.json
```

## Notes

- Authentication uses a single shared username/password (`aedes.authenticate`).
- Persistence lives in `/app/mydb` inside the container — mount a volume there
  (the compose file already does) so data survives container recreation.
- If the build fails on a machine with two network connections, check that the
  Docker DNS is pointed at an online connection — npm can fail if it resolves to
  an offline NIC.
