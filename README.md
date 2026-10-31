# mqtt-broker-aedes

A broker is plumbing, and plumbing should be quiet. This one is small enough to read.

**A message broker should be small enough to read in an afternoon, keep its data on a disk
you own, and never quietly drop a message.**

That is the whole belief, and it constrains what this will not do: it will never become a
managed cloud service, it will never require an account to talk to it, it will never phone
home with telemetry, and its persistence will never live somewhere you cannot see. What it
does — carry MQTT between your own devices — is only the proof that the belief holds.

**What is here:** `index.ts` and `src/` are the broker · `test/` is the suite
(`vitest.config.mts`, 101 tests) · `Dockerfile` and `docker-compose.yml` run it ·
`.env.example` carries the credentials and the port.

It is built on [Aedes](https://github.com/moscajs/aedes), written in TypeScript, with LevelDB
persistence and username/password authentication.

---

## Requirements

- **Docker** + **Docker Compose v2** (recommended), or
- **Node.js 22+** and npm for local development

---

## Verify it is working

However you started the broker, this proves it end to end: one terminal listens, another
publishes, and the message comes back.

Listening, and leaving it running:

```bash
npx mqtt sub -h localhost -p 1883 -u aedesuser -P changeme -t 'test/#' -v
```

Publishing, in a second terminal:

```bash
npx mqtt pub -h localhost -p 1883 -u aedesuser -P changeme -t test/hello -m 'it works'
```

The first terminal should print `test/hello it works`. `npx` fetches the MQTT.js client on
the spot, so this works on a machine that has only Docker and nothing else installed.

Two alternatives, both equivalent:

**If `mosquitto-clients` is installed** — `mosquitto_sub -h localhost -p 1883 -u aedesuser
-P changeme -t 'test/#' -v`, then `mosquitto_pub -h localhost -p 1883 -u aedesuser -P
changeme -t test/hello -m 'it works'`.

**If you are working inside this repo** after `npm install`, the `mqtt` client is already
there:

```bash
node -e "const m=require('mqtt');const c=m.connect('mqtt://localhost:1883',{username:'aedesuser',password:'changeme',reconnectPeriod:0});c.on('connect',()=>{console.log('connected');c.subscribe('t',{qos:1},()=>c.publish('t','it works',{qos:1}))});c.on('message',(t,p)=>{console.log(t,p.toString());c.end(true)});c.on('error',e=>{console.log('error',e.message);process.exit(1)})"
```

A wrong username or password is refused with MQTT return code 4. If the client never
connects, compare the credentials you are sending with the environment the container
actually received — `docker compose config` or `docker inspect mqtt-broker-aedes` will show
it.

---

## Run without cloning (prebuilt image)

A prebuilt multi-arch image (`linux/amd64` + `linux/arm64`) is published to
[GitHub Container Registry](https://github.com/nodejavascript/mqtt-broker-aedes/pkgs/container/mqtt-broker-aedes)
on every push to `master`. The `latest` tag tracks that last push, so it is only as current
as the most recent release — pull by digest, or build from source below, when you need to be
certain exactly which commit you are running.

Create a `docker-compose.yml` anywhere on the machine:

```yaml
services:
  mqtt-broker:
    image: ghcr.io/nodejavascript/mqtt-broker-aedes:latest
    restart: unless-stopped
    ports:
      - "1883:1883"
    environment:
      NODE_ENV: production
      AEDES_BROKER_NAME: aedesname
      AEDES_USERNAME: aedesuser
      AEDES_PASSWORD: changeme   # ⚠ change this
      AEDES_DB_PATH: /app/mydb
    volumes:
      - mqtt-data:/app/mydb      # persist the LevelDB store

volumes:
  mqtt-data:
```

Start it, and watch it come up:

```bash
docker compose up -d
```

```bash
docker compose logs -f
```

`docker compose down` stops it and leaves your messages in the `mqtt-data` volume.
`docker compose down -v` also deletes that volume — and every retained message and
subscription with it.

---

## Run with Docker Compose (build from source)

### Standalone (inside this repo)

Build the image and start it from the `docker-compose.yml` that ships here:

```bash
docker compose up -d --build
```

```bash
docker compose logs -f
```

The service is named `mqtt-broker` and the container `mqtt-broker-aedes`. Connect an MQTT
client to `mqtt://localhost:1883` using the credentials in `docker-compose.yml` — defaults
`aedesuser` / `changeme`, so **change the password** before exposing it.

Check it, then stop it:

```bash
docker compose ps
```

```bash
docker compose down
```

```bash
docker compose down -v
```

Note the difference: `down` keeps the `mqtt-data` volume, so retained messages and
persisted subscriptions are still there next time. `down -v` deletes it as well.

### Add to your existing `docker-compose.yml`

Copy this service into the stack you already run, and point `build:` at this repo on disk:

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

Then bring up just that service, without disturbing the rest of the stack:

```bash
docker compose up -d --build mqtt-broker
```

If port `1883` is already taken on the host, publish a different one instead — the broker
listens on `1883` inside the container regardless:

```yaml
    ports:
      - "1884:1883"
```

---

## Run with Docker

Build the image:

```bash
docker build . -t mqtt-broker-aedes
```

Run it, with the store on a named volume so data survives the container:

```bash
docker run -d --name mqtt-broker-aedes --restart unless-stopped -p 1883:1883 -v mqtt-data:/app/mydb -e NODE_ENV=production -e AEDES_BROKER_NAME=aedesname -e AEDES_USERNAME=aedesuser -e AEDES_PASSWORD=changeme mqtt-broker-aedes
```

Follow the log:

```bash
docker logs -f mqtt-broker-aedes
```

Stop and remove the container:

```bash
docker stop mqtt-broker-aedes
```

```bash
docker rm mqtt-broker-aedes
```

The `mqtt-data` volume outlives both, so starting a new container against it picks your
retained messages back up. Delete it deliberately when you mean it:

```bash
docker volume rm mqtt-data
```

---

## Local development

```bash
npm install
cp .env.example .env   # then edit the values
npm run dev            # tsx watch — restarts on every save
```

`npm run dev` runs the TypeScript source directly through
[tsx](https://github.com/privatenumber/tsx), so there is no separate compile step while you
work. `npm run build` produces `dist/` for `npm start` and for the container.

## Environment variables

| Variable            | Default     | Description                                        |
| ------------------- | ----------- | -------------------------------------------------- |
| `NODE_ENV`          | `local`     | Event logging only runs when set to `local`        |
| `DISPLAY_TABLE`     | (unset)     | `true` renders the event log as a live table       |
| `AEDES_PORT`        | `1883`      | Port the broker listens on                         |
| `AEDES_BROKER_NAME` | `aedesname` | Broker id (a random one is generated when unset)   |
| `AEDES_USERNAME`    | `aedesuser` | Username clients must authenticate with            |
| `AEDES_PASSWORD`    | (empty)     | Password clients must authenticate with            |
| `AEDES_DB_PATH`     | `./mydb`    | LevelDB persistence directory                      |
| `AEDES_CONCURRENCY` | `500`       | Message-queue concurrency                          |

`AEDES_PORT`, `AEDES_CONCURRENCY` and `DISPLAY_TABLE` are validated at startup: a bad port or
a non-positive concurrency stops the process with an error instead of listening somewhere
unexpected. `DISPLAY_TABLE` accepts `true`, `1`, `yes` or `on`; anything else — including the
literal word `false` — turns the table off.

## Scripts

```bash
npm run dev                # tsx watch, restarts on save
npm run build              # compile TypeScript to ./dist
npm run clean              # remove ./dist
npm start                  # run the compiled output (node dist/index.js)
npm run typecheck          # type-check source AND tests
npm test                   # all 101 tests
npm run test:unit          # unit tests only
npm run test:integration   # broker construction, no network
npm run test:e2e           # real broker over TCP + a real MQTT client
npm run test:watch         # re-run on change
```

## Testing

```bash
npm test
```

101 tests across three layers:

| Layer | File | What it proves |
| --- | --- | --- |
| unit | `test/unit/config.test.ts` | every environment value parses, and a bad one throws instead of defaulting silently |
| unit | `test/unit/auth.test.ts` | matching credentials pass, anything else gets CONNACK code 4, and each rejection is a fresh error |
| unit | `test/unit/events.test.ts` | the event log, the counter, table vs text output, and that non-local runs stay silent |
| unit | `test/unit/readline.test.ts` | the terminal helper clears in the right order |
| integration | `test/integration/aedes.test.ts` | broker construction, persistence wiring, in-process delivery, close |
| e2e | `test/e2e/broker.e2e.test.ts` | auth accept/reject, QoS 0/1/2, `+` and `#` wildcards, retained messages and their clearing, unsubscribe, fan-out, binary and 64 KiB payloads, client counts and lifecycle events |
| e2e | `test/e2e/start.e2e.test.ts` | ephemeral and fixed ports, a taken port rejecting, quiet mode, idempotent close, and that a closed broker stops accepting connections |

## Project structure

```
.
├── index.ts              # entry point — start, then shut down cleanly on SIGINT/SIGTERM
├── src/
│   ├── aedes.ts          # broker construction (persistence + message queue)
│   ├── auth.ts           # credential matching and the authenticate handler
│   ├── config.ts         # environment parsing and validation
│   ├── events.ts         # event logging
│   ├── index.ts          # server + auth + event wiring
│   ├── readline.ts       # terminal helper
│   └── types.d.ts        # ambient types for untyped deps
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/workflows/
│   ├── ci.yml            # typecheck, build, tests, production audit
│   └── docker-publish.yml # GHCR image on push to master
├── Dockerfile            # multi-stage build (Node 22 Alpine)
├── docker-compose.yml
├── tsconfig.json         # source build
└── tsconfig.test.json    # tests, type-checked but never emitted
```

## Notes

- Authentication uses a single shared username/password (`aedes.authenticate`).
  **An unset `AEDES_USERNAME` or `AEDES_PASSWORD` matches an unset client value**, so a broker
  with neither configured accepts anonymous clients. That has always been its behaviour and
  the tests state it plainly — configure both before exposing the broker.
- The broker speaks MQTT 3.1.1 and 5.0. Clients that send a bad username or password receive
  CONNACK return code 4.
- Persistence lives in `/app/mydb` inside the container — mount a volume there (the compose
  file already does) so data survives container recreation.
- If the build fails on a machine with two network connections, check that the Docker DNS is
  pointed at an online connection — npm can fail if it resolves to an offline NIC.

## Upgrading from 1.x

Version 2.0 moved to **aedes 1.x**, which changed three things that matter here:

- the broker is exported as a named `Aedes` class, not a default export;
- brokers must be created with `Aedes.createBroker()`, which also runs `listen()` — a bare
  `new Aedes()` skips it and is deprecated in aedes itself;
- the bundled persistence peers (`aedes-persistence-level` and friends) are declared optional,
  so `aedes-persistence-level` has to be a direct dependency, which it already is.

Tooling moved with it: TypeScript 7 (`module`/`moduleResolution` are now `nodenext`),
Node 22 as the minimum, `tsx` in place of `ts-node` + `nodemon`, and the `legacy-peer-deps`
workaround in `.npmrc` is gone because the peer set now resolves cleanly.
