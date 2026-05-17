#!/usr/bin/env bash
# Integration test runner.
# Starts docker-compose services, waits for health, runs migrations, runs tests, tears down.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/docker-compose.test.yml"
SERVER_DIR="$ROOT/server"

export TEST_DATABASE_URL="postgresql://test:test@localhost:5433/test_db"
export REDIS_URL="redis://localhost:6380"
export NODE_ENV="test"
export TOTP_ENCRYPTION_KEY="${TOTP_ENCRYPTION_KEY:-$(openssl rand -base64 32)}"

echo "==> Starting test containers..."
docker compose -f "$COMPOSE_FILE" up -d

cleanup() {
  echo "==> Stopping test containers..."
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for PostgreSQL..."
until docker compose -f "$COMPOSE_FILE" exec -T postgres_test \
    pg_isready -U test -d test_db -q; do
  sleep 1
done
echo "    PostgreSQL ready."

echo "==> Waiting for Redis..."
until docker compose -f "$COMPOSE_FILE" exec -T redis_test redis-cli ping | grep -q PONG; do
  sleep 1
done
echo "    Redis ready."

echo "==> Running migrations on test DB..."
cd "$SERVER_DIR"
DATABASE_URL="$TEST_DATABASE_URL" npx ts-node src/scripts/migrate.ts

echo "==> Running integration tests..."
DATABASE_URL="$TEST_DATABASE_URL" \
  npx jest --testPathPattern="integration" --runInBand --forceExit \
  "$@"

echo "==> Done."
