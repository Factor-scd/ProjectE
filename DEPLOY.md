# Project E — Deploy Guide

Production runs as a docker-compose stack on the deploy host (`10.0.0.204`). The stack has four services: PostgreSQL, the Hono API, the Vite SPA served by Caddy, and the Bun worker. Deploys are normally driven by Gitea Actions, but every step below can be run by hand.

## Architecture

```
Internet → :3000 (SPA container, Caddy)
              ├── /api/* → api:3000 (Hono/Bun)
              ├── /mcp*  → api:3000 (Hono/Bun)
              └── /*     → index.html (SPA fallback)

API (:3001, direct) → PostgreSQL (:5432)
Worker → PostgreSQL
```

Caddy (in the `spa` container) serves the built SPA and reverse-proxies `/api/*` and `/mcp*` to the `api` service. The API is also exposed directly on :3001 for debugging.

## Services

| Service | Container | Image / Build | Ports | Notes |
|---------|-----------|---------------|-------|-------|
| `db` | `project-e-db` | `postgres:16-alpine` | 5432 | Data in the `project-e-pg-data` volume |
| `api` | `project-e-api` | `Dockerfile.api` | 3001 → 3000 | Hono on Bun |
| `spa` | `project-e-spa` | `Dockerfile.spa` | 3000 → 80 | Built Vite SPA + Caddy |
| `worker` | `project-e-worker` | `Dockerfile.worker` | none | Bun worker |

All services share the `project-e-network` bridge and restart unless stopped.

## CI/CD pipeline (Gitea Actions)

The workflow lives at `.gitea/workflows/ci.yml` and runs on the self-hosted runner `projecte-runner`, which is colocated with the deploy host.

- **`quality`** — runs on every push and pull request: `bun install --frozen-lockfile` → `bun run typecheck` → web build (`cd apps/web && bun run build`) → `docker compose build`. A failed quality gate blocks the deploy job.
- **`deploy`** — runs on pushes to `main` and on `workflow_dispatch`. It checks out the code and runs `bash script/deploy.sh` with `DEPLOY_DIR` defaulting to `/home/projecte/ProjectE`.
- **`smoke`** — runs after `deploy` (also on deploy failure): API health at `http://localhost:3000/api/health`, SPA root returns HTML, and a login POST to `/api/auth/credentials` using `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` from the host `.env`.

### What `script/deploy.sh` does

Idempotent, safe to re-run. It:

1. Syncs the CI checkout into `DEPLOY_DIR` (rsync, excluding `.git`, `node_modules`, build artifacts, and `.env`)
2. Loads secrets from the host `.env` (never overwrites it)
3. Installs dependencies with `bun install --frozen-lockfile`
4. Runs `bun run db:migrate`
5. Runs `docker compose build` and `docker compose up -d`
6. Waits up to 60s for `http://localhost:3000/api/health` to return HTTP 200, dumping recent API logs if it times out

## Secrets

Secrets live in the host `.env` at `/home/projecte/ProjectE/.env`. This file is gitignored; never commit it. To set it up:

```bash
cp .env.example .env
```

Fill in `POSTGRES_PASSWORD`, `DATABASE_URL`, `AUTH_SECRET` (or `NEXTAUTH_SECRET`), `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and, as needed, `NODE_ENV`, `PUBLIC_URL`, `COOKIE_SECURE`, and `ALLOWED_HOSTS`. `deploy.sh` sources it, and docker-compose reads the `POSTGRES_PASSWORD` and `DATABASE_URL` values from it.

## Manual deploy

On the deploy host:

```bash
cd /home/projecte/ProjectE

# Pull latest
git pull origin main

# Install dependencies
bun install

# Apply schema + triggers (idempotent)
bun run db:migrate

# Build images
docker compose build

# Restart the stack
docker compose up -d

# Wait for API health
until curl -s http://localhost:3000/api/health | grep -q '"status"'; do sleep 2; done

# Check status
docker compose ps
```

## Database migrations

`bun run db:migrate` chains two idempotent steps:

- `db:sync` — `drizzle-kit push --force`, which syncs the schema in `packages/db/src/schema.ts` to the database
- `db:triggers` — `script/apply-triggers.ts`, which applies the search-vector triggers from `drizzle/0005_search_vector_trigger.sql` (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS`)

Both are safe to run on every deploy. Schema changes go through `bun run db:generate` in development, then land in `drizzle/` before the next deploy.

## Rollback

Compose images are rebuilt from the checkout, so there are no pinned image tags to restore. To roll back a bad release:

1. Revert the checkout to the previous good commit: `git revert <sha>` (or `git checkout <sha>`) and push to `main`
2. Re-run the manual deploy steps (`docker compose build`, `docker compose up -d`)

The `project-e-pg-data` volume is untouched by deploys and rollbacks, so the database survives both. If a deploy failed, `deploy.sh` exits non-zero with the recent API logs; do not force it past a failing health check.

## Logs

```bash
# All services
docker compose logs --tail=50 -f

# Specific service
docker compose logs --tail=50 -f api
docker compose logs --tail=50 -f spa
docker compose logs --tail=50 -f worker
docker compose logs --tail=50 -f db
```

## Debugging

### API health (direct, :3001)

```bash
curl http://localhost:3001/api/health
```

Returns `{"status":"ok", ...}` with a database ping (`database.connected`, `database.ping_ms`).

### API health (through Caddy)

```bash
curl http://localhost:3000/api/health
```

### SPA health check

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

### Login test

```bash
curl -s -X POST http://localhost:3000/api/auth/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"<INITIAL_ADMIN_EMAIL>","password":"<INITIAL_ADMIN_PASSWORD>"}'
```

Expect HTTP 200 and a `session` cookie.

### Container health

```bash
docker inspect project-e-db --format '{{.State.Health.Status}}'
```

### Restart or rebuild one service

```bash
docker compose restart api

docker compose build spa
docker compose up -d --force-recreate spa
```

## Important notes

- The `project-e-pg-data` Docker volume contains the live database. **Do not delete it.** Back it up (volume snapshot or `pg_dump`) before major schema work.
- Port 3000 is the SPA (Caddy); port 3001 is the API directly (for debugging).
- The MCP endpoint requires a valid API key (separate from JWT auth).
- The root `worker/` directory is legacy. The active worker is `apps/worker`.
