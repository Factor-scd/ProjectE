# Project E — Deploy Guide

## How to redeploy

```bash
cd ~/ProjectE

# Pull latest
git pull origin redesign/ui-v2

# Rebuild images
docker compose build

# Restart stack
docker compose up -d

# Check status
docker compose ps
```

## How to roll back

If the new stack fails:

```bash
cd ~/ProjectE

# Stop the new stack
docker compose down

# Restart the old worker (Node) from the legacy compose
# (The old compose file is preserved in git history)
# docker compose -f docker-compose.legacy.yml up -d worker
```

## How to view logs

```bash
# All services
docker compose logs --tail=50 -f

# Specific service
docker compose logs --tail=50 -f api
docker compose logs --tail=50 -f spa
docker compose logs --tail=50 -f worker
docker compose logs --tail=50 -f db
```

## How to debug

### API health check
```bash
curl http://localhost:3001/api/health
```

### SPA health check
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

### API through reverse proxy
```bash
curl http://localhost:3000/api/health
```

### Login test
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/credentials \
  -H "Content-Type: application/json" \
  -d email:user@example.com | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get(token,))")
echo "Token: $TOKEN"
```

### Check container health
```bash
docker inspect project-e-db --format {{.State.Health.Status}}
```

### Restart a single service
```bash
docker compose restart api
docker compose restart spa
```

### Rebuild a single service
```bash
docker compose build spa
docker compose up -d --force-recreate spa
```

## Architecture

```
Internet → :3000 → Caddy (SPA container)
                        ├── /api/* → api:3000 (Hono/Bun)
                        ├── /mcp*  → api:3000 (Hono/Bun)
                        └── /*     → index.html (SPA fallback)

API (:3001, direct) → PostgreSQL (:5432)
Worker → PostgreSQL
```

## Important notes

- The `project-e-pg-data` Docker volume contains the live database. **Do not delete it.**
- The `apps/web-legacy/` directory contains the old Next.js app for reference. **Do not delete it.**
- Port 3000 is the SPA (Caddy), port 3001 is the API directly (for debugging).
- The MCP endpoint requires a valid API key (separate from JWT auth).
EOF cd ~/ProjectE && cat > DEPLOY.md << 'EOF'
# Project E — Deploy Guide

## How to redeploy

```bash
cd ~/ProjectE

# Pull latest
git pull origin redesign/ui-v2

# Rebuild images
docker compose build

# Restart stack
docker compose up -d

# Check status
docker compose ps
```

## How to roll back

If the new stack fails:

```bash
cd ~/ProjectE

# Stop the new stack
docker compose down

# Restart the old worker (Node) from the legacy compose
# (The old compose file is preserved in git history)
# docker compose -f docker-compose.legacy.yml up -d worker
```

## How to view logs

```bash
# All services
docker compose logs --tail=50 -f

# Specific service
docker compose logs --tail=50 -f api
docker compose logs --tail=50 -f spa
docker compose logs --tail=50 -f worker
docker compose logs --tail=50 -f db
```

## How to debug

### API health check
```bash
curl http://localhost:3001/api/health
```

### SPA health check
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

### API through reverse proxy
```bash
curl http://localhost:3000/api/health
```

### Login test
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/credentials \
  -H "Content-Type: application/json" \
  -d password:<password> | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get(token,))")
echo "Token: $TOKEN"
```

### Check container health
```bash
docker inspect project-e-db --format {{.State.Health.Status}}
```

### Restart a single service
```bash
docker compose restart api
docker compose restart spa
```

### Rebuild a single service
```bash
docker compose build spa
docker compose up -d --force-recreate spa
```

## Architecture

```
Internet → :3000 → Caddy (SPA container)
                        ├── /api/* → api:3000 (Hono/Bun)
                        ├── /mcp*  → api:3000 (Hono/Bun)
                        └── /*     → index.html (SPA fallback)

API (:3001, direct) → PostgreSQL (:5432)
Worker → PostgreSQL
```

## Important notes

- The `project-e-pg-data` Docker volume contains the live database. **Do not delete it.**
- The `apps/web-legacy/` directory contains the old Next.js app for reference. **Do not delete it.**
- Port 3000 is the SPA (Caddy), port 3001 is the API directly (for debugging).
- The MCP endpoint requires a valid API key (separate from JWT auth).
