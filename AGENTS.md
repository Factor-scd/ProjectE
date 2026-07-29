# AGENTS.md — Project E v2 Agent Contract

## Core Rules

Every API route that writes data (INSERT/UPDATE/DELETE) MUST follow this pattern:

1. **Drizzle write** — Perform the database operation
2. **Activity feed insert** — Call `recordActivity()` with actor, action, entity_type, entity_id, changes, workspace_id
3. **pg_notify** — `recordActivity()` handles this automatically via `pg.notify('project_e_events', payload)`

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

## Build Before Commit

- Run `npm run build --workspace=apps/web` before committing
- Do NOT commit build artifacts (`.next/`, `dist/`, `.turbo/`)

## Schema

- All Drizzle schema lives in `packages/db/src/schema.ts`
- Import via `@project-e/db` or `@project-e/db/schema`
- Use Drizzle ORM for all database operations
- Never write raw SQL except for `pg_notify` calls

## Realtime

- SSE endpoint at `/api/realtime` uses PostgreSQL LISTEN/NOTIFY
- Event format: `{ type, action, id, workspace_id }`
- Heartbeat every 30 seconds
- Filter by `?workspace_id=` query param
