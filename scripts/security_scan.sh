#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v rg >/dev/null 2>&1; then
  echo "[security] ripgrep (rg) is required but not installed." >&2
  exit 2
fi

echo "[security] scanning tracked/untracked source for potential secret leakage..."

has_issue=0

pattern_hits="$(mktemp)"
trap 'rm -f "$pattern_hits"' EXIT

# High-signal secret patterns.
rg -n --hidden --glob '!.git' --glob '!__pycache__' \
  -e '-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'ASIA[0-9A-Z]{16}' \
  -e 'xox[baprs]-[0-9A-Za-z-]{10,}' \
  -e 'gh[pousr]_[A-Za-z0-9]{20,}' \
  -e 'sk-[A-Za-z0-9]{20,}' \
  -e 'AIza[0-9A-Za-z\-_]{20,}' \
  -e '(?i)\b(secret|password|passwd|api[_-]?key|client[_-]?secret)\b\s*[:=]\s*["\x27]?[A-Za-z0-9_\-\./+=]{8,}' \
  . >"$pattern_hits" || true

if [[ -s "$pattern_hits" ]]; then
  has_issue=1
  echo "[security] potential secret-like matches found:" >&2
  cat "$pattern_hits" >&2
fi

echo "[security] checking for high-risk local files..."
file_hits="$(find . -maxdepth 4 -type f \( \
  -name '*.pem' -o -name '*.key' -o -name '.env' -o -name '.env.*' -o \
  -name '*.p12' -o -name '*.pfx' -o -name 'id_rsa' -o \
  -name '*.sqlite' -o -name '*.db' -o -name '*.log' \
\) | sort)"

if [[ -n "$file_hits" ]]; then
  has_issue=1
  echo "[security] high-risk files detected (verify before commit):" >&2
  echo "$file_hits" >&2
fi

if [[ "$has_issue" -eq 1 ]]; then
  echo "[security] FAILED: review findings before pushing." >&2
  exit 1
fi

echo "[security] OK: no obvious secret leakage signals found."
