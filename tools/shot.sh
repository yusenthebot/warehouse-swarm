#!/bin/bash
# Headless screenshot of the live sim — REAL-VERIFY eyes-on-screen.
# Serves the dir over http (ES modules need http, not file://), advances the
# canvas animation under virtual time, screenshots, then tears the server down.
# Usage: tools/shot.sh [out.png] [virtual-ms] [port]
set -e
OUT="${1:-.shot/sim.png}"
VMS="${2:-9000}"
PORT="${3:-8137}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$(dirname "$OUT")"

python3 -m http.server "$PORT" --directory "$ROOT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 0.6

google-chrome-stable --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1180,620 --virtual-time-budget="$VMS" \
  --screenshot="$OUT" "http://localhost:$PORT/index.html" >/dev/null 2>&1

echo "wrote $OUT ($(stat -c%s "$OUT" 2>/dev/null || echo 0) bytes)"
