# Project E — Deploy Guide

Production runs as a docker-compose stack on the deploy host (`10.0.0.52`). The stack has four services: PostgreSQL, the Hono API, the Vite SPA served by Caddy, and the Bun worker. **Komodo now owns builds and deploys** — Gitea Actions runs quality+e2e only.

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

| Service | Container | Image | Ports | Notes |
|---------|-----------|-------|-------|-------|
| `db` | `project-e-db` | `postgres:16-alpine` | 5432 | Data in `project-e-pg-data` volume |
| `api` | `project-e-api` | `git.buzzbee.dev/BuzzbeeSCD/projecte-api:{tag}` | 3001 → 3000 | Hono on Bun |
| `spa` | `project-e-spa` | `git.buzzbee.dev/BuzzbeeSCD/projecte-spa:{tag}` | 3000 → 80 | Built Vite SPA + Caddy |
| `worker` | `project-e-worker` | `git.buzzbee.dev/BuzzbeeSCD/projecte-worker:{tag}` | none | Bun worker |

All services share the `project-e-network` bridge and restart unless stopped.

## CI/CD pipeline

### Gitea Actions (quality + e2e only)

The workflow lives at `.gitea/workflows/ci.yml` and runs on the self-hosted runner `projecte-runner`. It runs only quality checks and e2e tests:

- **`quality`** — runs on every push and PR: typecheck → web build → docker compose build
- **`e2e`** — runs after quality: ephemeral Postgres → db:migrate → Playwright tests

### Komodo (build + deploy)

Komodo manages image builds and stack deploys:

- **Build trigger:** push a `v*` tag → Gitea webhook fires → Komodo builds images → pushes to Gitea registry
- **Deploy trigger:** Komodo procedure `release-projecte` builds all three images, then deploys the stack on `10.0.0.52`
- **Webhook URL:** `https://komodo.example.com/listener/github/repo/{id}/build`
- **Rollback:** re-deploy a previous version tag via Komodo UI or API

## Deploying

### Primary: Komodo

1. Push a version tag: `git tag v1.0.0 && git push origin v1.0.0`
2. Komodo builds images and deploys automatically
3. Verify: `docker ps` on .52, health checks

### Break-glass: deploy.sh

If Komodo is unavailable, `script/deploy.sh` still works:

```bash
ssh projecte
cd /opt/app/ProjectE
export PROJECTE_IMAGE_TAG=v1.0.0
bash script/deploy.sh
```

This pulls images from the registry and redeploys. It no longer builds — that's Komodo's job.

## Rollback

1. In Komodo UI: Deployments → projecte → select previous version tag → Redeploy
2. Or via API: `POST /execute/DeployStack` with the previous image tag
3. Verify health checks pass

## Secrets

Komodo manages runtime secrets (POSTGRES_PASSWORD, AUTH_SECRET, etc.) as Komodo variables. The host `.env` is kept as break-glass fallback only.
