# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install all dependencies (incl. dev) to compile TypeScript
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY index.ts ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine

ENV NODE_ENV=production

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
