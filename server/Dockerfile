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

# НЕ отключаем TLS-проверку глобально — это касалось бы SMTP/S3/HIBP (MITM).
# TLS к БД настраивается точечно в config/database.ts.
ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
