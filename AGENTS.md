# AGENTS.md — Project E v2 Agent Contract

## Stack

- Monorepo: Turborepo + Bun workspaces, `packageManager bun@1.3.14`. Use `bun` for every command. Do not use `npm`.
- `apps/web`: Vite + React 19 SPA (TanStack Router/Query, shadcn/ui, Tailwind). Dev server on :3000 proxies `/api` and `/mcp` to :3001.
- `apps/api`: Hono API server on Bun, port 3001 (Docker) / 3000 via the Vite proxy in dev.
- `apps/worker`: Bun background worker (`src/index.ts`). The root `worker/` directory is legacy and NOT used.
- `apps/web-legacy`: legacy v1 app, kept for reference only. Do not edit.
- `packages/db`: Drizzle ORM + `postgres` client. `packages/shared`: shared types, schemas, constants.

## Core Rules

Every API route that writes data (INSERT/UPDATE/DELETE) MUST follow this pattern:

1. **Drizzle write** — Perform the database operation
2. **Activity feed insert** — Call `recordActivity()` with actor, action, entity_type, entity_id, changes, workspace_id
3. **pg_notify** — `recordActivity()` handles this automatically via `pg.notify('project_e_events', payload)`

## Shared Helpers

Both live in `apps/api/src/middleware/`. Use them; do not re-implement.

- `requireWorkspaceAccess(c, workspaceId)` (`middleware/auth.ts`) — verifies a workspace exists and the current user owns it. Returns the domain row. Throws 403 FORBIDDEN when the id is missing/empty or not owned, 404 NOT_FOUND when no such workspace exists. Call it at the top of every workspace-scoped route.
- `recordActivityForEntity({ actor, action, entityType, entityId, changes, workspaceId })` (`middleware/activity.ts`) — same as `recordActivity()` but resolves the workspace from the entity row when `workspaceId` is omitted. Unknown entity types or unresolvable entities are logged and skipped, never fatal to the request.

## Soft-Delete Only

- Never use SQL `DELETE` on user data tables
- Set `deleted_at = now()` for soft-delete
- Default queries MUST filter `deleted_at IS NULL`
- Junction tables (task_tags, habit_tags, etc.) use hard DELETE since they have no `deleted_at` column

## Error Format

All errors return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_ERROR`

## Workspace-Scoped Routes

- All entities are scoped to a workspace (domain)
- Route pattern: `/api/domains/[domainId]/[entity]/...`
- Every entity table has a `domain_id` FK (or `workspace_id` for activity_feed/webhooks)
- Use `requireWorkspaceAccess(workspaceId)` to verify the workspace exists

## CI/CD Contract

- CI runs on Gitea Actions (`.gitea/workflows/ci.yml`) on the self-hosted runner `projecte-runner`.
- Every push and pull request must pass the `quality` job: `bun install --frozen-lockfile` → `bun run typecheck` → web build (`cd apps/web && bun run build`) → `docker compose build`.
- A push to `main` (or a manual `workflow_dispatch`) triggers `deploy`, which runs `bash script/deploy.sh`. The `smoke` job then checks API health, SPA HTML, and login.
- Do not commit build artifacts (`.next/`, `dist/`, `.turbo/`, `*.tsbuildinfo`).

## Build Before Commit

- Run `bun run typecheck` (typechecks api, worker, and web)
- Run `cd apps/web && bun run build` to verify the SPA builds
- Do NOT commit build artifacts (`.next/`, `dist/`, `.turbo/`)

## Schema

- All Drizzle schema lives in `packages/db/src/schema.ts`
- Import via `@project-e/db` or `@project-e/db/schema`
- Use Drizzle ORM for all database operations
- Never write raw SQL except for `pg_notify` calls

## Migrations

- Migrations live in `drizzle/` (0000–0005). Generate a new one with `bun run db:generate` after editing the schema.
- `bun run db:migrate` is the deploy-time migration: `db:sync` (`drizzle-kit push --force`) then `db:triggers` (`script/apply-triggers.ts`, search-vector triggers). Both are idempotent; safe to run on every deploy.

## Realtime

- SSE endpoint at `/api/realtime` uses PostgreSQL LISTEN/NOTIFY
- Event format: `{ type, action, id, workspace_id }`
- Heartbeat every 30 seconds
- Filter by `?workspace_id=` query param
