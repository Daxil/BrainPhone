# Root Dockerfile — builds frontend + backend in one image.
# Build from project root: docker build -t brainphone .
# Express serves SPA on same domain → no CORS issues.
#
# Required env vars in Yandex Cloud container:
#   DATABASE_URL, TOTP_ENCRYPTION_KEY, NODE_ENV=production

# ─── Stage 1: build frontend ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# ─── Stage 2: build backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY server/package*.json server/tsconfig.json ./
RUN npm ci
COPY server .
RUN npm run build

# ─── Stage 3: production runtime ──────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --only=production

COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/migrations ./migrations

# SPA — served by Express catch-all route in production
COPY --from=frontend-builder /client/dist ./client/dist

COPY server/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# NB: НЕ отключаем TLS-проверку глобально (NODE_TLS_REJECT_UNAUTHORIZED=0) —
# это отключало бы её и для SMTP/S3/HIBP (риск MITM). TLS к managed PG
# настраивается точечно в config/database.ts (CA-серт через DB_CA_CERT или
# rejectUnauthorized:false только для БД).
ENV NODE_ENV=production

# SPA lives at /app/client/dist in this image. The app's default resolves to
# ../../client/dist (correct for the dev monorepo layout, i.e. server/dist/ →
# repo-root/client/dist), which points OUTSIDE /app here — so set it explicitly.
ENV SPA_DIST_PATH=/app/client/dist

# Yandex Cloud Serverless Containers default port
EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
