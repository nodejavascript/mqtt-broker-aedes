# ---- build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install all dependencies (incl. dev) to compile TypeScript
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine

ENV NODE_ENV=production

# Shown by the registry and by `docker inspect`, so an image in the wild can say what it is
# and where it came from without anyone having to guess.
LABEL org.opencontainers.image.title="mqtt-broker-aedes" \
      org.opencontainers.image.description="A small MQTT broker over Aedes, with LevelDB persistence — it keeps its data on a disk you own and never quietly drops a message." \
      org.opencontainers.image.source="https://github.com/nodejavascript/mqtt-broker-aedes" \
      org.opencontainers.image.url="https://github.com/nodejavascript/mqtt-broker-aedes" \
      org.opencontainers.image.documentation="https://github.com/nodejavascript/mqtt-broker-aedes#readme" \
      org.opencontainers.image.licenses="ISC"

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the compiled output
COPY --from=build /app/dist ./dist

# Persist the LevelDB store across container restarts
VOLUME ["/app/mydb"]

EXPOSE 1883

CMD [ "node", "dist/index.js" ]
