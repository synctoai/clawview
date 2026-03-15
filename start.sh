#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-8788}"
STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
HISTORY_ROOT="${CLAWVIEW_HISTORY_DIR:-${CLAWVIEW_BACKUP_DIR:-$HOME/.clawview}}"
if [[ "$(basename "$HISTORY_ROOT")" == ".clawview" ]]; then
  HISTORY_DIR="$HISTORY_ROOT/history/v1"
else
  HISTORY_DIR="$HISTORY_ROOT/.clawview/history/v1"
fi

echo "[clawview] launching..."
echo "[clawview] state dir: $STATE_DIR"
echo "[clawview] history  : $HISTORY_DIR"
echo "[clawview] port     : $PORT"

exec python3 "$ROOT_DIR/app.py" \
  --state-dir "$STATE_DIR" \
  --history-root "$HISTORY_ROOT" \
  --port "$PORT" \
  --open
