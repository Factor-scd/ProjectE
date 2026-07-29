# Realtime System

## Architecture

```
API Route (write)
  │
  ├── Drizzle INSERT/UPDATE/DELETE
  ├── Activity feed INSERT (via recordActivity)
  └── pg.notify('project_e_events', payload) (via recordActivity)
        │
        ▼
SSE Endpoint (/api/realtime)
  │
  ├── LISTEN project_e_events
  ├── Filter by workspace_id
  └── Push to EventSource
        │
        ▼
Zustand Store (entity slices)
  │
  ├── Receives event: { type, action, id, workspace_id }
  ├── Re-fetches affected entity
  └── Components re-render
```

## SSE Event Format

```json
{
  "type": "task",
  "action": "created",
  "id": "uuid",
  "workspace_id": "uuid"
}
```

## Connection

- Endpoint: `GET /api/realtime?workspace_id=uuid`
- Content-Type: `text/event-stream`
- Heartbeat: `:ping` every 30 seconds
- Reconnection: Client-side exponential backoff

## Trigger Pattern

Every write API route calls `recordActivity()` which handles both the activity feed insert and the pg_notify call.
