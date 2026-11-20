#!/usr/bin/env bash
#
# deploy-home-server.sh
# ---------------------------------------------------------------------------
# Ship the current commit to the home server and rebuild the container.
#
#     bash scripts/deploy-home-server.sh
#
# The server keeps a real git checkout at /srv/memorysphere/scripture, so this
# is: push -> pull -> rebuild. The app is a container on the MemorySphere
# network (ms-scripture) and Caddy publishes it at /scripture/ on the existing
# HTTPS and LAN entry points, so no host port is opened.
# ---------------------------------------------------------------------------
set -euo pipefail

SERVER="${SERVER:-wwkzorin@192.168.0.221}"
REMOTE_DIR="${REMOTE_DIR:-/srv/memorysphere/scripture}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-fork}"   # local remote the server pulls from
BRANCH="${BRANCH:-main}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

COMMIT="$(git rev-parse --short HEAD)"
BRANCH_NOW="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH_NOW" != "$BRANCH" ]; then
  echo "Refusing to deploy: on '$BRANCH_NOW', expected '$BRANCH'." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to deploy: working tree has uncommitted changes." >&2
  exit 1
fi

echo "==> publishing $COMMIT to '$DEPLOY_REMOTE'"
git push "$DEPLOY_REMOTE" "$BRANCH"

echo "==> updating the server checkout"
ssh "$SERVER" "cd '$REMOTE_DIR' && git fetch --quiet origin && git merge --ff-only origin/$BRANCH && git log --oneline -1"

echo "==> rebuilding the container"
ssh "$SERVER" "cd '$REMOTE_DIR' && docker compose -f compose.home-server.yaml up -d --build 2>&1 | tail -4"

echo "==> waiting for the health check"
ok=0
for _ in $(seq 1 30); do
  sleep 2
  if ssh "$SERVER" "docker exec ms-scripture node -e \"fetch('http://127.0.0.1:3000/scripture/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" 2>/dev/null; then
    ok=1
    break
  fi
done

[ "$ok" = "1" ] || { echo "Health check failed - see: ssh $SERVER 'docker logs ms-scripture'"; exit 1; }

echo "OK"
echo ""
echo "  LAN      : http://192.168.0.221:8080/scripture/"
echo "  Tailscale: https://wwkzorin-ux330cak.taila44cf2.ts.net/scripture/"
