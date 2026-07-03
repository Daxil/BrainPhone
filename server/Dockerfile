# Build context: server/ directory
# Frontend must be pre-built: run `cd ../client && npm run build` first
# Or use the root-level Dockerfile that handles everything.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache postgresql-client ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
