#!/usr/bin/env bash
# ZAP baseline security scan.
# Usage:
#   ./scripts/security_scan.sh                # expects app on localhost:3001
#   ./scripts/security_scan.sh --start-app    # starts app via docker-compose first
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_PORT="${APP_PORT:-3001}"
TARGET_URL="http://localhost:${TARGET_PORT}"
REPORT_DIR="$ROOT/zap-report"
ZAP_CONF="$ROOT/zap.conf"
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"

mkdir -p "$REPORT_DIR"

START_APP=false
for arg in "$@"; do
  [[ "$arg" == "--start-app" ]] && START_APP=true
done

APP_STARTED=false
if $START_APP; then
  echo "==> Starting application..."
  docker compose -f "$ROOT/docker-compose.yml" up -d 2>/dev/null || true
  APP_STARTED=true

  echo "==> Waiting for app to be ready..."
  for i in $(seq 1 30); do
    if curl -sf "$TARGET_URL/health" > /dev/null 2>&1; then
      echo "    App ready."
      break
    fi
    sleep 2
  done
fi

cleanup() {
  if $APP_STARTED; then
    echo "==> Stopping application..."
    docker compose -f "$ROOT/docker-compose.yml" down 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Running ZAP baseline scan against $TARGET_URL..."

ZAP_CONF_MOUNT=""
if [ -f "$ZAP_CONF" ]; then
  ZAP_CONF_MOUNT="-v $ROOT:/zap/proj:ro"
  CONF_FLAG="-c /zap/proj/zap.conf"
else
  CONF_FLAG=""
fi

docker run --rm \
  --network host \
  -v "$REPORT_DIR":/zap/wrk/:rw \
  $ZAP_CONF_MOUNT \
  "$ZAP_IMAGE" \
  zap-baseline.py \
    -t "$TARGET_URL" \
    -r zap-report.html \
    -J zap-report.json \
    -l WARN \
    $CONF_FLAG \
    || ZAP_EXIT=$?

ZAP_EXIT="${ZAP_EXIT:-0}"

echo "==> ZAP reports written to: $REPORT_DIR/"

# Parse JSON report for Medium+ findings
if command -v python3 &>/dev/null && [ -f "$REPORT_DIR/zap-report.json" ]; then
  MEDIUM_PLUS=$(python3 - "$REPORT_DIR/zap-report.json" <<'PYEOF'
import sys, json
with open(sys.argv[1]) as f:
    data = json.load(f)
alerts = data.get('site', [{}])[0].get('alerts', [])
risk_map = {'High': 3, 'Medium': 2, 'Low': 1, 'Informational': 0}
findings = [a for a in alerts if risk_map.get(a.get('riskdesc','').split()[0], 0) >= 2]
for a in findings:
    print(f"  [{a.get('riskdesc','?')}] {a.get('name','?')}")
print(len(findings))
PYEOF
  )
  COUNT=$(echo "$MEDIUM_PLUS" | tail -1)
  DETAILS=$(echo "$MEDIUM_PLUS" | head -n -1)

  if [ "$COUNT" -gt 0 ]; then
    echo ""
    echo "⚠️  ZAP found $COUNT Medium+ finding(s):"
    echo "$DETAILS"
    echo ""
    echo "Open $REPORT_DIR/zap-report.html for full details."
    exit 2
  else
    echo "✅ No Medium+ findings."
  fi
else
  # Fallback: use ZAP exit code
  if [ "$ZAP_EXIT" -ne 0 ]; then
    echo "⚠️  ZAP exited with code $ZAP_EXIT — review $REPORT_DIR/zap-report.html"
    exit "$ZAP_EXIT"
  fi
  echo "✅ ZAP scan complete."
fi
