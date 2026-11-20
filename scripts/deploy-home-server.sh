#!/usr/bin/env bash
#
# deploy-home-server.sh
# ---------------------------------------------------------------------------
# Push this checkout to the home server and rebuild the app container.
# Run it from Windows (Git Bash) or from the server itself:
#
#     bash scripts/deploy-home-server.sh
#
# The app is a container on the MemorySphere network (ms-scripture); Caddy
# publishes it at /scripture/ on the existing HTTPS and LAN entry points, so
# no host port is opened.
# ---------------------------------------------------------------------------
set -euo pipefail

SERVER="${SERVER:-wwkzorin@192.168.0.221}"
REMOTE_DIR="${REMOTE_DIR:-/srv/memorysphere/scripture}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$APP_DIR"

echo "==> copying sources to ${SERVER}:${REMOTE_DIR}"
tar --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./logs -czf - . \
  | ssh "$SERVER" "mkdir -p '$REMOTE_DIR' && tar -xzf - -C '$REMOTE_DIR'"

echo "==> normalising line endings (Windows checkouts carry CRLF)"
ssh "$SERVER" "cd '$REMOTE_DIR' && \
  find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.mjs' \
    -o -name '*.json' -o -name '*.html' -o -name '*.css' -o -name '*.yaml' \
    -o -name '*.yml' -o -name '*.md' -o -name '*.txt' -o -name '*.sh' \\) \
    -exec dos2unix -q {} + ; \
  dos2unix -q Dockerfile .dockerignore 2>/dev/null || true"

echo "==> building and restarting the container"
ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose -f compose.home-server.yaml up -d --build 2>&1 | tail -6"

echo "==> waiting for the health check"
for _ in $(seq 1 30); do
  sleep 2
  if ssh "$SERVER" "docker exec ms-scripture node -e \"fetch('http://127.0.0.1:3000/scripture/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" 2>/dev/null; then
    echoed=1
    echo "OK"
    break
  fi
done

[ "${echoed:-0}" = "1" ] || { echo "Health check failed - see: ssh $SERVER 'docker logs ms-scripture'"; exit 1; }

echo ""
echo "  LAN     : http://192.168.0.221:8080/scripture/"
echo "  Tailscale: https://wwkzorin-ux330cak.taila44cf2.ts.net/scripture/"
