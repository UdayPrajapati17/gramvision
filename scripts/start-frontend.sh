#!/usr/bin/env bash
# Starts the GramVision app on http://127.0.0.1:5173
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"

if [ ! -d node_modules ]; then
  printf '\033[1;31mFrontend packages are missing. Run ./scripts/setup-macos.sh first.\033[0m\n' >&2
  exit 1
fi

printf '\033[1;36mGramVision on http://127.0.0.1:5173  (Ctrl+C to stop)\033[0m\n'
exec npm run dev
