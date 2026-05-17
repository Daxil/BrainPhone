#!/bin/sh
set -e

echo "Applying migrations..."
node dist/scripts/migrate.js

echo "Starting BrainPhone API server..."
exec node dist/app.js
