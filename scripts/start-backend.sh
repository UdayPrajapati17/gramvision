#!/usr/bin/env bash
# Starts the GramVision API on http://127.0.0.1:8000
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

if [ ! -d .venv ]; then
  printf '\033[1;31mNo Python environment found. Run ./scripts/setup-macos.sh first.\033[0m\n' >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate
printf '\033[1;36mGramVision API on http://127.0.0.1:8000  (Ctrl+C to stop)\033[0m\n'
exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
