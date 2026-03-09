#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8788}"
STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"

echo "[clawview] launching..."
echo "[clawview] state dir: $STATE_DIR"
echo "[clawview] port     : $PORT"

exec python3 "$ROOT_DIR/app.py" --state-dir "$STATE_DIR" --port "$PORT" --open
