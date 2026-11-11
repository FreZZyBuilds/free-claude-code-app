#!/usr/bin/env sh
# FCC Studio – one-command start (macOS / Linux).
#   ./scripts/start.sh            start fcc-server (if needed) + Studio, open the browser
#   FCC_URL=http://127.0.0.1:9000 ./scripts/start.sh   use an FCC on another port
#   ./scripts/start.sh --dev      Vite dev server with hot reload instead of the built app
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP="$ROOT/app"
FCC_URL=${FCC_URL:-http://127.0.0.1:8082}
STUDIO_PORT=${STUDIO_PORT:-5174}
DEV=0
[ "${1:-}" = "--dev" ] && DEV=1

say() { printf '\033[1;34m›\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js 20+ is required (https://nodejs.org)."

fcc_up() { curl -fsS --max-time 2 --noproxy '*' "$FCC_URL/health" >/dev/null 2>&1; }

FCC_PID=""
if fcc_up; then
  say "fcc-server already running at $FCC_URL"
else
  if command -v fcc-server >/dev/null 2>&1; then
    say "Starting fcc-server (installed)…"
    fcc-server > "$ROOT/.fcc-server.log" 2>&1 &
    FCC_PID=$!
  elif [ -f "$ROOT/server/pyproject.toml" ] && command -v uv >/dev/null 2>&1; then
    say "Starting fcc-server from ./server via uv (first run installs Python deps)…"
    (cd "$ROOT/server" && uv run fcc-server) > "$ROOT/.fcc-server.log" 2>&1 &
    FCC_PID=$!
  else
    die "fcc-server not found. Install it: curl -fsSL https://raw.githubusercontent.com/Alishahryar1/free-claude-code/main/scripts/install.sh | sh
   or run: git submodule update --init && install uv (https://docs.astral.sh/uv/)"
  fi
  i=0
  until fcc_up; do
    i=$((i + 1))
    [ $i -gt 120 ] && die "fcc-server did not start. See $ROOT/.fcc-server.log"
    sleep 1
  done
  say "fcc-server is up"
fi

cleanup() { [ -n "$FCC_PID" ] && kill "$FCC_PID" 2>/dev/null || true; }
trap cleanup INT TERM EXIT

cd "$APP"
[ -d node_modules ] || { say "Installing app dependencies…"; npm ci --no-audit --no-fund; }

if [ $DEV -eq 1 ]; then
  URL="http://127.0.0.1:5173"
else
  if [ ! -f dist/index.html ] || [ -n "$(find src index.html -newer dist/index.html 2>/dev/null | head -1)" ]; then
    say "Building FCC Studio…"
    npm run build --silent
  fi
  URL="http://127.0.0.1:$STUDIO_PORT"
fi

( sleep 1.5
  if command -v open >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  fi ) &

say "FCC Studio → $URL"
if [ $DEV -eq 1 ]; then
  FCC_URL="$FCC_URL" npx vite
else
  FCC_URL="$FCC_URL" STUDIO_PORT="$STUDIO_PORT" node server.mjs
fi
