#!/usr/bin/env bash
# Project E — idempotent deploy script.
#
# Intended to run from the Gitea Actions self-hosted runner (projecte-runner),
# which lives on the same host as the docker-compose stack, but it is also safe
# to run manually from a checkout or from DEPLOY_DIR itself.
#
# Safety guarantees:
#   - The host .env is never overwritten (secrets stay on the host).
#   - The project-e-pg-data volume is never touched/deleted.
#   - Safe to re-run: schema sync (drizzle-kit push --force) and trigger
#     application are idempotent, and `docker compose up -d` only recreates
#     services whose config/image changed.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/home/projecte/ProjectE}"

echo "=== Project E deploy ==="
echo "Deploy dir:  ${DEPLOY_DIR}"
echo "Working dir: $(pwd)"

# ── 1. Sync the CI checkout into DEPLOY_DIR ───────────────────────────────
if [ "$(pwd)" != "${DEPLOY_DIR}" ]; then
  echo "Syncing checkout into ${DEPLOY_DIR} ..."
  mkdir -p "${DEPLOY_DIR}"

  if command -v rsync &>/dev/null; then
    rsync -a --delete \
      --exclude '.git' \
      --exclude 'node_modules' \
      --exclude '.next' \
      --exclude 'dist' \
      --exclude '.turbo' \
      --exclude '*.tsbuildinfo' \
      --exclude '.env' \
      ./ "${DEPLOY_DIR}/"
  else
    echo "rsync not available; falling back to cp -r of needed top-level entries"
    cp -r package.json bunfig.toml bun.lock \
      apps packages db drizzle script \
      Dockerfile.* \
      Caddyfile docker-compose.yml \
      "${DEPLOY_DIR}/"
  fi
else
  echo "Already in DEPLOY_DIR; skipping sync"
fi

# ── 2. Operate from the deploy directory ──────────────────────────────────
cd "${DEPLOY_DIR}"

# ── 3. Load secrets from the host .env (docker compose also picks these up) ─
if [ -f .env ]; then
  echo "Loading ${DEPLOY_DIR}/.env"
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
else
  echo "WARNING: no .env found in ${DEPLOY_DIR}; DATABASE_URL may be unset"
fi

# ── 4. Ensure bun ──────────────────────────────────────────────────────────
if ! command -v bun &>/dev/null; then
  echo "Installing bun 1.3.14 ..."
  npm i -g bun@1.3.14
fi
echo "bun: $(bun --version)"

# ── 5. Install dependencies ────────────────────────────────────────────────
if ! bun install --frozen-lockfile; then
  echo "bun install --frozen-lockfile failed; retrying without --frozen-lockfile"
  bun install
fi

# ── 6. Database schema + triggers (both idempotent) ───────────────────────
echo "Migrating database schema + triggers (db:migrate) ..."
bun run db:migrate

# ── 7. Build images and start the stack ───────────────────────────────────
echo "Building docker images ..."
docker compose build
echo "Starting stack ..."
docker compose up -d

# ── 8. Wait for API health (up to 60s) ────────────────────────────────────
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
echo "Waiting for API health at ${HEALTH_URL} (max 60s) ..."
healthy=0
for i in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}" 2>/dev/null || true)"
  if [ "${code}" = "200" ]; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "${healthy}" = "1" ]; then
  echo "API healthy after ${i}s (HTTP 200)"
else
  echo "ERROR: API did not return HTTP 200 within 60s"
  echo "--- recent api logs ---"
  docker compose logs --tail=50 api || true
  echo "------------------------"
  exit 1
fi

# ── 9. Print SPA status ────────────────────────────────────────────────────
echo "SPA HTTP status: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ || true)"

echo "Deploy complete: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
