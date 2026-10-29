#!/usr/bin/env bash
# One-time setup for GramVision on macOS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say() { printf '\n\033[1;36m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m%s\033[0m\n' "$1" >&2; exit 1; }

command -v python3 >/dev/null || fail "python3 is not installed. Run: brew install python"
command -v node >/dev/null || fail "Node.js is not installed. Run: brew install node"

PY_OK=$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 10) else 0)')
[ "$PY_OK" = "1" ] || fail "Python 3.10 or newer is required. Found $(python3 --version)."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18 or newer is required. Found $(node --version)."

say "Creating the Python environment in backend/.venv"
cd "$ROOT/backend"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet

if [ ! -f .env ]; then
  cp "$ROOT/.env.example" .env
  SECRET=$(python -c 'import secrets; print(secrets.token_urlsafe(48))')
  python - "$SECRET" <<'PY'
import sys, pathlib
secret = sys.argv[1]
path = pathlib.Path(".env")
text = path.read_text().replace("replace-with-a-long-random-secret", secret)
path.write_text(text)
PY
  say "Wrote backend/.env with a fresh SECRET_KEY"
fi

say "Installing the frontend packages"
cd "$ROOT/frontend"
npm install --no-audit --no-fund

cat <<'DONE'

Setup finished.

Start GramVision in two Terminal tabs:

  Tab 1:  ./scripts/start-backend.sh
  Tab 2:  ./scripts/start-frontend.sh

Then open http://127.0.0.1:5173
DONE
