# API Patterns

## Route Structure

All routes are workspace-scoped:

```
GET    /api/domains/:domainId/tasks          — List tasks
POST   /api/domains/:domainId/tasks          — Create task
GET    /api/domains/:domainId/tasks/:id      — Get task
PATCH  /api/domains/:domainId/tasks/:id      — Update task
DELETE /api/domains/:domainId/tasks/:id      — Soft-delete task
```

Same pattern for: habits, projects, notes, domains, tags, sections, webhooks, activity-feed.

## Query Parameters

| Param | Purpose | Example |
|-------|---------|---------|
| `?limit=&offset=` | Pagination | `?limit=20&offset=0` |
| `?sort=` | Sorting | `?sort=-created` (descending) |
| `?status=` | Filter by status | `?status=todo,in_progress` |
| `?priority=` | Filter by priority | `?priority=high,urgent` |
| `?tag=` | Filter by tag | `?tag=meeting` |
| `?domain=` | Filter by domain | `?domain=uuid` |
| `?search=` | Full-text search | `?search=deploy` |

## Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": { "field": "title" }
  }
}
```

Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `INTERNAL_ERROR`

## Write Pattern

Every write API route MUST:
1. Drizzle write (INSERT/UPDATE/DELETE)
2. Insert activity feed entry via `recordActivity()`
3. `pg.notify('project_e_events', payload)` — handled by `recordActivity()`
