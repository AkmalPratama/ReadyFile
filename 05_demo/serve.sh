#!/usr/bin/env bash
# Serve the repo over HTTP so the browser can load ES modules and seed.json.
# ES modules do not load from file://, so the mockup needs a local server.
#   bash 05_demo/serve.sh          → http://localhost:8000/05_demo/
#   PORT=9000 bash 05_demo/serve.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8000}"
echo "ReadyFile delivery-layer mockup: http://localhost:${PORT}/05_demo/"
exec python3 -m http.server "$PORT" --bind 127.0.0.1