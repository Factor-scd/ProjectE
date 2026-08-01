# Project E — UI Redesign Baseline

**Date:** 2026-07-31  
**Server hostname:** `projecte` (10.0.0.204)  
**Branch:** `redesign/ui-v2` (from `integration/ux-28-gaps`, commit `c1e0a08`)  
**Bun version:** 1.3.14  
**DB schema snapshot:** `.migration-baseline-schema.sql` (1372 lines)

## Disk before cleanup
- 20G total, 11G used, 9.1G free
- `node_modules`: 415M (root) + 294K (apps/web)
- `.next` build outputs: 109M
- Total repo size: 575M

## Disk after cleanup
- 20G total, 12G used, 9.0G free
- Repo size: 48M (node_modules, .next, tsbuildinfo removed)
- ~527 MB freed from build artifacts

## Container state after T0
| Container | Status |
|-----------|--------|
| `project-e-db` | Running (healthy) — PostgreSQL 16 |
| `project-e-worker` | Running — Node.js worker |
| `project-e-web` | **Stopped & removed** — Next.js (big-bang per user decision) |

## URL status
- http://10.0.0.204:3000 — **DOWN** (until Phase 7 deploys the new SPA)

## What T1 (Phase 1 Scaffold) needs to do next
1. Create the Vite SPA scaffold in `apps/web/` (replacing the old Next.js app)
2. Create the Hono API scaffold in `apps/api/`
3. Set up Bun workspace in root `package.json`
4. Wire up the new `docker-compose.yml` for the new stack
5. Reference `.migration-baseline-schema.sql` for the DB schema the new API must preserve
6. Use `bun` (v1.3.14) for all package management and runtime
7. Keep `db` and `worker` containers running

## T1 — Phase 1 Scaffold (completed)

### Legacy code moved
- Old Next.js `apps/web/` → `apps/web-legacy/` (preserved for T2-T8 reference)

### New apps created
| App | Path | Tech | Port |
|-----|------|------|------|
| SPA | `apps/web/` | Vite 5 + React 19 + TanStack Router/Query + shadcn/ui | :3000 (dev) |
| API | `apps/api/` | Hono 4 + Bun | :3001 |
| Worker | `apps/worker/` | Bun + Drizzle | — |

### Shared infrastructure
- `db/client.ts` — shared Drizzle client (postgres-js driver)
- `db/` — root-level directory (shared by api + worker)
- `bunfig.toml` — Bun package manager config
- Root `package.json` — Bun workspaces monorepo (`apps/*`, `packages/*`)

### Docker
- `Dockerfile.api` — Bun base, copies apps/api + db + packages
- `Dockerfile.worker` — Bun base, copies apps/worker + db + packages
- `Dockerfile.spa` — Multi-stage: Bun build → Caddy serve
- `Caddyfile` — Serves dist on :80, reverse-proxies /api/* and /mcp to api:3000
- `docker-compose.yml` — 4 services: db, api, spa, worker (old web service removed)

## Phase 7 — Deploy (completed)

**Deploy time:** 2026-08-01T02:40Z  
**Commit:** `fc59431140329bd93223dfae3c72406d9e02646e`  
**Branch:** `redesign/ui-v2`

### Image SHAs
| Image | SHA256 |
|-------|--------|
| `projecte-api` | `fc46878d1618bb3a0d6a43d645a21cad14caa1bb6eaf773e4e32579a268adc10` |
| `projecte-spa` | `1cced4e61fb35d31df53225b3c8f5863a3d581b82ed961c13286bd5e3f940f48` |
| `projecte-worker` | `7fc57170100f6cf6b12439835f5700383c7c4570eecf3c4ab3f06fa739d10d07` |

### Compose file SHA
`bb21417829c866048509f81881304e81b5e29430270a278e0b3a77caa68f8b1b`

### Verification results
| Check | Result |
|-------|--------|
| `docker compose ps` — all 4 services running, db healthy | ✅ |
| `curl :3000/api/health` — 200 + `{"status":"ok"}` | ✅ |
| `curl :3000/` — 200 + HTML | ✅ |
| Login (user@example.com) — token received | ✅ |
| `/api/domains` — 2 domains returned | ✅ |
| `/mcp` — endpoint reachable (requires API key) | ✅ |
| All 13 page routes return 200 | ✅ (13/13) |

### Container state
| Container | Status | Ports |
|-----------|--------|-------|
| `project-e-db` | Running (healthy) | :5432 |
| `project-e-api` | Running | :3001 |
| `project-e-spa` | Running | :3000 |
| `project-e-worker` | Running | — |

### URL
- http://10.0.0.204:3000 — **LIVE** (SPA served by Caddy, API reverse-proxied)
