# API Documentation

Project E exposes a REST API built with [Hono](https://hono.dev/) running on [Bun](https://bun.sh/). All endpoints live under `/api/` and exchange JSON.

The API server listens on port 3001 (Docker) and is proxied from the Vite dev server on port 3000. In development, `http://localhost:3000/api/...` reaches the same routes as `http://localhost:3001/api/...`.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Request and Response Format](#request-and-response-format)
- [Error Handling](#error-handling)
- [Pagination and Sorting](#pagination-and-sorting)
- [Domain Scoping](#domain-scoping)
- [Health](#health)
- [Auth](#auth)
- [Domains](#domains)
- [Tasks](#tasks)
- [Habits](#habits)
- [Projects](#projects)
- [Notes](#notes)
- [Search](#search)
- [Calendar](#calendar)
- [Graph](#graph)
- [Dashboard](#dashboard)
- [Agents](#agents)
- [Webhooks](#webhooks)
- [Canvas](#canvas)
- [Daily Notes](#daily-notes)
- [Tags](#tags)
- [Custom Fields](#custom-fields)
- [Error Log](#error-log)
- [Analytics](#analytics)
- [Notifications](#notifications)
- [Export and Import](#export-and-import)
- [Realtime (SSE)](#realtime-sse)
- [MCP](#mcp)

## Overview

| Item | Value |
|------|-------|
| Framework | Hono, served by Bun (`bun run dev` / the API Docker image) |
| Base path | `/api` |
| Body format | JSON (`Content-Type: application/json`) |
| Auth | Cookie session, JWT bearer token, or API key |
| Database | PostgreSQL via Drizzle ORM |

All routes mount through `apps/api/src/index.ts`:

```
/api/auth         /api/tasks        /api/habits       /api/projects
/api/notes        /api/search       /api/calendar     /api/graph
/api/dashboard    /api/agents       /api/webhooks     /api/canvas
/api/daily-notes  /api/tags         /api/custom-fields
/api/error-log    /api/analytics    /api/notifications
/api/export       /api/import       /api/realtime     /api/mcp
/api/health
```

## Authentication

Every endpoint except `GET /api/health` requires authentication. The API accepts three credential forms, in this order of resolution:

1. **Session cookie** named `session`, set by `POST /api/auth/credentials`. The cookie is `httpOnly`, `SameSite=Lax`, and persists for 30 days. The JWT inside it expires after 7 days.
2. **Bearer token** via the `Authorization: Bearer <token>` header. The token can be the same JWT issued at login, or an API key.
3. **API key** in the `Authorization: Bearer <apiKey>` header. Keys are validated against the `api_keys` table, which stores only the SHA-256 hash of the key.

API keys are the required credential for `POST /api/mcp` (JSON-RPC). The MCP endpoint does not accept cookie or JWT auth.

### Credentials login

`POST /api/auth/credentials` with `{ email, password }`. On success the server sets the `session` cookie and returns the user plus the JWT:

```bash
curl -X POST http://localhost:3000/api/auth/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"your-password"}' \
  -c cookies.txt
```

```json
{
  "user": {
    "id": "a1b2c3d4-...",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

First login auto-creates the admin account. When the `users` table is empty, the request is accepted only if `email` matches `INITIAL_ADMIN_EMAIL` and `password` matches `INITIAL_ADMIN_PASSWORD` from the environment. The created account uses `INITIAL_ADMIN_NAME` or the email as its display name.

Invalid credentials return `401 UNAUTHORIZED`.

### Session check

`GET /api/auth/session` returns the current session state. It never errors on an unauthenticated request:

```json
{ "authenticated": true, "user": { "id": "...", "email": "...", "name": "..." } }
```

```json
{ "authenticated": false, "user": null }
```

### Current user

`GET /api/auth/me` returns the authenticated user or `401 UNAUTHORIZED`:

```json
{ "user": { "id": "...", "email": "...", "name": "..." } }
```

### Logout

`POST /api/auth/logout` clears the `session` cookie and returns `{ "success": true }`.

### Removed features

Passkey authentication was removed. The legacy passkey routes issued a session without verifying the WebAuthn signature, which was an authentication bypass. Do not re-add passkey endpoints without full WebAuthn challenge/attestation verification.

## Request and Response Format

Write endpoints (`POST`, `PATCH`, `PUT`) expect a JSON body with `Content-Type: application/json`. Bodies are validated with Zod schemas. Invalid input returns `400 VALIDATION_ERROR`.

Success status codes:

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `204` | Deleted (no body) |

Responses use camelCase field names (`domainId`, `createdAt`, `deletedAt`). Timestamps are ISO 8601 strings with timezone.

## Error Handling

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "code": "invalid_string",
        "message": "Title is required",
        "path": ["title"]
      }
    ]
  }
}
```

`details` appears only when present (mostly Zod validation issues). Error codes:

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid credentials |
| `VALIDATION_ERROR` | 400 | Request body or params failed validation |
| `NOT_FOUND` | 404 | Resource does not exist |
| `FORBIDDEN` | 403 | Missing workspace ID, or the workspace belongs to someone else |
| `CONFLICT` | 409 | State conflict (reserved; not currently returned by routes) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

Two endpoints deviate from the envelope:

- `GET /api/realtime` returns `401` with `{ "error": "Unauthorized" }` when unauthenticated.
- `POST /api/mcp` returns JSON-RPC error objects (see [MCP](#mcp)).

## Pagination and Sorting

Most list endpoints paginate with `page` and `perPage`:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number, 1-indexed |
| `perPage` | number | 50 | 100 | Items per page |

Response shape:

```json
{
  "items": [],
  "totalItems": 42,
  "totalPages": 3,
  "page": 1,
  "perPage": 50
}
```

Tasks, habits, projects, and notes also accept `limit` and `offset` (default limit 50, max 200). These four endpoints echo both styles in the response (`page`, `perPage`, `limit`, `offset`).

Sorting uses `sort=<field>` with a leading `-` for descending:

```bash
GET /api/tasks?sort=-due_date
```

Some endpoints (tasks, habits, projects, notes) accept a separate `order=asc|desc` parameter that flips the sort direction.

Endpoints that return everything for a domain (calendar events, graph nodes, custom fields, notifications, agent activity) skip pagination and return `{ items, totalItems }` or `{ items, count }`.

## Domain Scoping

Every entity belongs to a domain (workspace). All by-ID routes verify the caller owns the entity's domain through `requireWorkspaceAccess` and return `403 FORBIDDEN` (missing or foreign workspace) or `404 NOT_FOUND` (no such workspace) otherwise.

List endpoints accept `?domain=<id>` to scope results. When omitted, they resolve the user's active domain: the user's first domain by `sortOrder` then `createdAt`, or a "Personal" domain auto-created on first use.

## Health

#### `GET /api/health`

No authentication required. Pings the database and reports runtime state:

```json
{
  "status": "ok",
  "timestamp": "2026-08-10T10:30:00.000Z",
  "version": "0.1.0",
  "runtime": "bun",
  "uptime": 12345.6,
  "database": {
    "connected": true,
    "ping_ms": 4
  }
}
```

`status` is `ok` when the DB ping succeeds and `degraded` when it fails. `database.ping_ms` is `-1` on failure.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/credentials` | Log in with email and password; sets `session` cookie |
| `GET` | `/api/auth/session` | Return `{ authenticated, user }` |
| `GET` | `/api/auth/me` | Return the current user |
| `POST` | `/api/auth/logout` | Clear the session cookie |

## Domains

Domains are workspaces. They are owned by a single user (`ownerId`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/domains` | List the caller's domains |
| `POST` | `/api/domains` | Create a domain |
| `GET` | `/api/domains/:id` | Get a domain |
| `PATCH` | `/api/domains/:id` | Update a domain |
| `DELETE` | `/api/domains/:id` | Delete a domain |

**List query parameters:** `page`, `perPage`, `sort` (`name`, `slug`, `sort_order`, `created_at`, `updated_at`; default `sort_order`), `filter` (case-insensitive match on name or slug).

**Create:**

```bash
curl -X POST http://localhost:3000/api/domains \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Work","slug":"work","color":"#3b82f6"}'
```

`name` is required. `slug` defaults to a slugified name. Response (`201`):

```json
{
  "id": "b2c3d4e5-...",
  "name": "Work",
  "slug": "work",
  "color": "#3b82f6",
  "icon": null,
  "ownerId": "a1b2c3d4-...",
  "parentId": null,
  "sortOrder": 0,
  "customFields": {},
  "createdAt": "2026-08-10T10:30:00.000Z",
  "updatedAt": "2026-08-10T10:30:00.000Z"
}
```

`PATCH /api/domains/:id` accepts any subset of `name`, `slug`, `color`, `icon`, `parentId`. `DELETE` returns `204` and hard-deletes the row (domains have no `deleted_at` column).

## Tasks

Task statuses: `todo`, `in_progress`, `done`, `cancelled`. Priorities: `low`, `medium`, `high`, `urgent`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Create a task |
| `POST` | `/api/tasks/reorder` | Persist Kanban column ordering |
| `GET` | `/api/tasks/:id` | Get a task with subtasks, tags, dependencies |
| `PATCH` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Soft-delete a task |
| `POST` | `/api/tasks/:id/status` | Change task status (Kanban drag) |
| `POST` | `/api/tasks/:id/tags` | Assign a tag |
| `DELETE` | `/api/tasks/:id/tags/:tagId` | Remove a tag |
| `GET` | `/api/tasks/:id/history` | Status change log (from activity feed) |
| `GET` | `/api/tasks/:id/comments` | List comments |
| `POST` | `/api/tasks/:id/comments` | Add a comment |
| `GET` | `/api/tasks/:id/attachments` | List attachment metadata |

### List tasks

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Workspace ID; defaults to active domain |
| `search` | string | Case-insensitive match on title |
| `filter` | string | Case-insensitive match on title or description |
| `status` | string | Comma-separated statuses |
| `priority` | string | Comma-separated priorities |
| `tag` | string | Comma-separated tag IDs (task must have all) |
| `parent_id` | string | Filter by parent; `null` for root tasks |
| `project_id` | string | Filter by project |
| `section_id` | string | Filter by project section |
| `sort` | string | `created`, `updated`, `title`, `status`, `priority`, `order`, `due_date` (default `-created`) |
| `order` | string | `asc` or `desc` |
| `page` / `perPage` | number | Pagination (default 1 / 50) |
| `limit` / `offset` | number | Alternative pagination (max limit 200) |

**Example:**

```bash
curl "http://localhost:3000/api/tasks?status=todo,in_progress&sort=due_date&domain=<domainId>" \
  -b cookies.txt
```

```json
{
  "items": [
    {
      "id": "c3d4e5f6-...",
      "title": "Complete documentation",
      "description": "Write API docs",
      "status": "todo",
      "priority": "high",
      "domainId": "b2c3d4e5-...",
      "projectId": null,
      "sectionId": null,
      "parentId": null,
      "dueDate": "2026-08-20T00:00:00.000Z",
      "completedAt": null,
      "estimatedMinutes": null,
      "trackedMinutes": 0,
      "recurrenceRule": null,
      "order": 0,
      "customFields": {},
      "createdAt": "2026-08-10T10:30:00.000Z",
      "updatedAt": "2026-08-10T10:30:00.000Z",
      "tags": []
    }
  ],
  "totalItems": 1,
  "totalPages": 1,
  "page": 1,
  "perPage": 50,
  "limit": 50,
  "offset": 0
}
```

### Create a task

`title` is required. `domain` defaults to the active domain. Other accepted fields: `description`, `status`, `priority`, `projectId`, `sectionId`, `parentId`, `dueDate` (ISO 8601), `estimatedMinutes`, `order`, `customFields`, `recurrenceRule` (RRule string; the worker spawns the next occurrence), `tagIds`.

```json
{
  "title": "Ship the release",
  "description": "Cut the v0.2.0 tag",
  "status": "in_progress",
  "priority": "urgent",
  "dueDate": "2026-08-20T17:00:00.000Z",
  "tagIds": ["f1a2b3c4-..."]
}
```

Response (`201`) is the created task. Setting `parentId` requires the parent to exist and not be deleted (`404 NOT_FOUND` otherwise).

### Reorder

`POST /api/tasks/reorder` with `{ "orderedIds": ["id1", "id2", "id3"], "domain": "<domainId>" }`. `domain` is optional; it resolves from the first task when omitted. Every ID must exist in the workspace and be non-deleted, or the request returns `404`. Tasks are assigned `order` 0..n in transaction. Response:

```json
{ "success": true, "orderedIds": ["id1", "id2", "id3"] }
```

### Get a single task

`GET /api/tasks/:id` returns the task enriched with `subtasks`, `tags` (array of `{ id, name, color }`), `dependencies` (tasks this task blocks on), and `dependents` (tasks that block on this one).

### Update

`PATCH /api/tasks/:id` accepts any subset of the create fields. A task cannot be its own parent, and `parentId` cycles are rejected with `400 VALIDATION_ERROR`.

### Delete

`DELETE /api/tasks/:id` soft-deletes the task (sets `deletedAt`) and returns `204`. Recurring spawns for the task are stopped.

### Change status

`POST /api/tasks/:id/status` with `{ "status": "done" }`. Marking a task `done` also sets `completedAt`.

### Tags

`POST /api/tasks/:id/tags` with `{ "tagId": "<uuid>" }` returns `201 { "success": true }`. Re-assigning the same tag is a no-op, not an error. `DELETE /api/tasks/:id/tags/:tagId` returns `204`.

### Comments and attachments

Comments and attachment metadata are stored in the activity feed with entity types `comment` and `attachment`. `POST /api/tasks/:id/comments` takes `{ "content": "..." }` and returns `201 { "success": true }`. `GET` endpoints return `{ items, totalItems }`, newest first.

## Habits

Habit frequencies: `daily`, `weekly`, `custom`. Difficulties: `easy`, `medium`, `hard`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/habits` | List habits |
| `POST` | `/api/habits` | Create a habit |
| `GET` | `/api/habits/:id` | Get a habit with recent completions, tags |
| `PATCH` | `/api/habits/:id` | Update a habit |
| `DELETE` | `/api/habits/:id` | Soft-delete a habit |
| `POST` | `/api/habits/:id/complete` | Log a completion for today |
| `GET` | `/api/habits/:id/completions` | Completion history |
| `POST` | `/api/habits/:id/tags` | Assign a tag |
| `DELETE` | `/api/habits/:id/tags/:tagId` | Remove a tag |

### List habits

**Query parameters:** `domain`, `active` (`true`/`false`), `frequency`, `difficulty`, `tag` (comma-separated tag IDs), `search`/`filter` (match on name), `sort` (`created`, `updated`, `name`, `frequency`, `difficulty`, `streak_count`; default `-created`), `order`, `page`/`perPage`, `limit`/`offset`.

### Create

`name` is required. Other fields: `description`, `domain` (defaults to active), `frequency`, `difficulty`, `goalPerPeriod` (default 1), `unit`, `reminderTime`, `skipDays` (array of 0-6 weekday numbers), `moodTracking`, `active` (default true), `tagIds`.

### Complete

`POST /api/habits/:id/complete` with:

```json
{ "value": 1, "mood": 5, "notes": "Felt great" }
```

`value` is required (default 1). `mood` is 1-5, `notes` optional. Response (`201`) includes the stored completion plus updated streaks:

```json
{
  "completion": {
    "id": "d4e5f6a7-...",
    "habitId": "e5f6a7b8-...",
    "date": "2026-08-10T12:00:00.000Z",
    "value": 1,
    "mood": 5,
    "notes": "Felt great",
    "createdAt": "2026-08-10T12:00:00.000Z"
  },
  "streakCount": 3,
  "bestStreak": 5
}
```

### Completions

`GET /api/habits/:id/completions` supports `from` and `to` (ISO timestamps), `limit` (default 365, max 1000), `offset`, and `order` (`asc`/`desc`). Returns `{ items, totalItems, limit, offset }`.

## Projects

Project statuses: `active`, `paused`, `completed`, `archived`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get a project with sections, tasks, progress |
| `PATCH` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Soft-delete a project |
| `GET` | `/api/projects/:id/sections` | List sections |
| `POST` | `/api/projects/:id/sections` | Create a section |
| `GET` | `/api/projects/:id/sections/:sid` | Get a section |
| `PATCH` | `/api/projects/:id/sections/:sid` | Update a section |
| `DELETE` | `/api/projects/:id/sections/:sid` | Delete a section |
| `GET` | `/api/projects/:id/members` | List members (from activity feed) |
| `POST` | `/api/projects/:id/members` | Add a member |
| `DELETE` | `/api/projects/:id/members/:uid` | Remove a member |

### List projects

**Query parameters:** `domain`, `status` (comma-separated), `search`/`filter` (match on name), `sort` (`created`, `updated`, `name`, `status`, `target_date`; default `-created`), `order`, `page`/`perPage`, `limit`/`offset`.

Each item carries `tags`, `taskCount`, `completedCount`, and `progress` (0-100).

### Create

`name` is required. Other fields: `description`, `domain` (defaults to active), `status` (default `active`), `color`, `icon`, `targetDate`, `tagIds`.

### Sections

Sections group tasks within a project. `kind` is `section` (default) or `milestone`; `status` is `planned`, `in_progress`, or `complete`.

Create with `{ "name": "Design phase", "kind": "milestone", "status": "in_progress", "targetDate": "...", "sortOrder": 1 }`. `sortOrder` defaults to one past the current max. Sections are hard-deleted (`204`); they have no `deleted_at` column.

### Members

Members are recorded in the activity feed with entity type `member`. `POST /api/projects/:id/members` takes `{ "userId": "<uuid>", "role": "member" }` (role optional, default `member`) and returns `201 { "success": true }`. Remove with `DELETE /api/projects/:id/members/:uid` (`204`).

## Notes

Notes store Tiptap HTML in `content`. Wikilinks in the content (Obsidian-style links to other notes and entities) are parsed and kept in sync on create and update.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/notes` | List notes |
| `POST` | `/api/notes` | Create a note |
| `GET` | `/api/notes/:id` | Get a note with tags, backlinks, outgoing links |
| `PATCH` | `/api/notes/:id` | Update a note |
| `DELETE` | `/api/notes/:id` | Soft-delete a note |
| `GET` | `/api/notes/:id/backlinks` | Notes that link to this one |
| `GET` | `/api/notes/:id/versions` | Edit history (from activity feed) |
| `POST` | `/api/notes/:id/tags` | Assign a tag |
| `DELETE` | `/api/notes/:id/tags/:tagId` | Remove a tag |

### List notes

**Query parameters:** `domain`, `pinned` (`true`), `archived` (`true`/`false`/`all`; default excludes archived), `tag` (comma-separated tag IDs), `search`/`filter` (match on title), `sort` (`title`, `created_at`, `updated_at`, `is_pinned`; default `-updated_at`), `order`, `page`/`perPage`, `limit`/`offset`.

### Create

`title` is required. Other fields: `content` (Tiptap HTML), `domain` (defaults to active), `isPinned`, `isArchived`, `tagIds`.

## Search

Full-text search across tasks, notes, projects, habits, and domains. Results are scoped to the caller's active domain. Backed by Postgres `search_vector` columns with `ts_headline` snippets.

#### `GET /api/search`

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required; empty returns `{ results: [], totalCount: 0 }`) |
| `types` | string | Comma-separated entity types; defaults to all five |
| `limit` | number | Max results (default 20, max 50) |
| `offset` | number | Offset into the ranked results (default 0) |

Entity types: `task`, `note`, `project`, `habit`, `domain`.

```json
{
  "results": [
    {
      "id": "c3d4e5f6-...",
      "type": "task",
      "title": "Complete documentation",
      "snippet": "Complete <mark>documentation</mark> for the API...",
      "score": 0.42,
      "workspaceId": "b2c3d4e5-...",
      "link": "/tasks/c3d4e5f6-..."
    }
  ],
  "totalCount": 1,
  "query": "documentation"
}
```

Two stubs exist: `GET /api/search/recent` returns `{ items: [], totalItems: 0 }` and `POST /api/search/index` returns `{ success: true, message: "Reindex triggered" }`. Neither performs work yet.

## Calendar

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/calendar/events` | List events in a time range |
| `POST` | `/api/calendar/events` | Create an event |
| `PATCH` | `/api/calendar/events/:id` | Update an event |
| `DELETE` | `/api/calendar/events/:id` | Delete an event |
| `GET` | `/api/calendar/upcoming` | Events in the next N days |

`GET /events` takes `from` and `to` (ISO timestamps, matched against `startTime`), plus `domain`. Returns events ordered by `startTime` ascending.

**Create:**

```json
{
  "title": "Sprint review",
  "description": "Demo the new dashboard",
  "startTime": "2026-08-14T15:00:00.000Z",
  "endTime": "2026-08-14T16:00:00.000Z",
  "allDay": false,
  "color": "#3b82f6",
  "entityType": "task",
  "entityId": "c3d4e5f6-...",
  "recurrenceRule": null
}
```

`title`, `startTime`, and `domain` are required. `GET /upcoming?days=7` (default 7, max 365) returns events from now through `days` days ahead. Events are hard-deleted (`204`).

## Graph

The knowledge graph of a domain: nodes for notes, tasks, habits, projects, sections, tags, and the domain itself; edges for note links, note-to-entity links, task dependencies, and domain membership.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/graph/nodes` | All nodes for a domain |
| `GET` | `/api/graph/edges` | All edges for a domain |
| `POST` | `/api/graph/edges` | Create a relationship |
| `DELETE` | `/api/graph/edges/:id` | Delete a relationship |

`domain` is required on both `GET` endpoints; omitting it returns `400 VALIDATION_ERROR`.

Node shape: `{ id, label, type, color }` with types `task`, `habit`, `project`, `note`, `section`, `tag`, `domain`. Edge shape: `{ source, target, type }`.

**Create an edge** with `{ "sourceId": "<uuid>", "targetId": "<uuid>", "type": "note_link" }`. Supported types:

| Type | Meaning |
|------|---------|
| `note_link` | Note to note (source and target are notes) |
| `note_entity` | Note to task (target is a task) |
| `task_dependency` | Task depends on task (source depends on target) |

Both endpoints must belong to the caller's domain, verified before any write. Response (`201`): `{ "success": true }`.

**Delete an edge** with `DELETE /api/graph/edges/:id` where `:id` is `"<sourceId>-<targetId>"`. The server resolves the source entity type, deletes from `note_links` or `task_dependencies`, and returns `204`.

## Dashboard

Per-user dashboard widgets, scoped to a domain.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/widgets` | List the caller's widgets for a domain |
| `POST` | `/api/dashboard/widgets` | Add a widget |
| `PATCH` | `/api/dashboard/widgets/:id` | Update a widget |
| `DELETE` | `/api/dashboard/widgets/:id` | Remove a widget |

**Create:**

```json
{
  "type": "task_progress",
  "title": "Sprint progress",
  "config": { "projectId": "..." },
  "layout": { "x": 0, "y": 0, "w": 4, "h": 2 }
}
```

`type` is required. `layout` defaults to `{ x: 0, y: 0, w: 2, h: 2 }`.

## Agents

Agents are API-authenticated assistants scoped to a domain. Creating one generates an `apiKey` (a UUID) that the agent presents as a bearer token. The MCP endpoint accepts the same key.

Permission tiers: `full_access`, `read_only`, `content_creator`, `task_manager`, `custom`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents` | List agents |
| `POST` | `/api/agents` | Create an agent |
| `GET` | `/api/agents/:id` | Get an agent |
| `PATCH` | `/api/agents/:id` | Update an agent |
| `DELETE` | `/api/agents/:id` | Delete an agent |
| `POST` | `/api/agents/:id/permissions` | Set permission tier and custom permissions |
| `GET` | `/api/agents/:id/permissions` | Get permissions |
| `GET` | `/api/agents/activity` | Activity across all agents in a domain |
| `GET` | `/api/agents/:id/activity` | Activity for one agent (`_all` for all) |

### List

**Query parameters:** `domain`, `q` (match on name), `sort` (`created`, `updated`, `name`; default `-created`), `page`, `perPage`.

### Create

```json
{
  "name": "Code Assistant",
  "description": "Reviews code and suggests changes",
  "status": "active",
  "permissionTier": "read_only",
  "customPermissions": [],
  "tags": ["assistant"],
  "config": {}
}
```

`name` and `domain` are required. Response (`201`) includes the generated `apiKey`. Store it; the API returns it only at creation.

### Activity

`GET /api/agents/activity` and `GET /api/agents/:id/activity` accept `action`, `from`, `to` (ISO timestamps; a bare `YYYY-MM-DD` bounds the whole day), `limit` (default 100, max 500), and `domain`. `GET /api/agents/_all/activity` is equivalent to `/api/agents/activity`. Activity rows carry `agentId`, `action`, `entityType`, `entityId`, `details`, `success`, `errorMessage`, `createdAt`.

## Webhooks

Webhooks are domain-scoped outgoing notifications. Creating or updating tasks, habits, projects, and notes enqueues deliveries for matching webhooks. A background worker performs the HTTP delivery and records the result in `webhook_deliveries`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/webhooks` | List webhooks |
| `POST` | `/api/webhooks` | Create a webhook |
| `PATCH` | `/api/webhooks/:id` | Update a webhook |
| `DELETE` | `/api/webhooks/:id` | Delete a webhook |
| `POST` | `/api/webhooks/:id/test` | Enqueue a test delivery |

### Create

```json
{
  "name": "Task Notifications",
  "url": "https://example.com/hook",
  "events": ["task.created", "task.updated", "task.completed"],
  "secret": "your-webhook-secret",
  "active": true,
  "retryCount": 3
}
```

`name`, `url`, `events`, and `domain` are required. `secret` enables payload signing. Event names follow `<entity>.<action>` with entities `task`, `habit`, `project`, `note`; the `test` event fires from the test endpoint.

### Delivery

The worker POSTs to the webhook URL with:

- `Content-Type: application/json`
- `X-Event-Type: <event>`
- `X-ProjectE-Signature: <hex HMAC-SHA256>` when a `secret` is set, computed over the raw JSON body

Payload:

```json
{
  "event": "task.created",
  "entity_type": "task",
  "entity_id": "c3d4e5f6-...",
  "data": { "title": "Complete documentation" },
  "timestamp": "2026-08-10T10:30:00.000Z",
  "workspace_id": "b2c3d4e5-..."
}
```

Deliveries use a 10 second timeout and are recorded in `webhook_deliveries` with status, status code, response body (first 1000 chars), and attempt count.

`POST /api/webhooks/:id/test` returns `{ "success": true, "message": "Test webhook queued" }` immediately; the worker performs the delivery.

## Canvas

Freeform or graph-mode whiteboards. A canvas has cards positioned on a viewport.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/canvas` | List canvases |
| `POST` | `/api/canvas` | Create a canvas |
| `GET` | `/api/canvas/:id` | Get a canvas with cards and connections |
| `PATCH` | `/api/canvas/:id` | Update a canvas |
| `DELETE` | `/api/canvas/:id` | Delete a canvas |
| `POST` | `/api/canvas/:id/cards` | Create one card |
| `PUT` | `/api/canvas/:id/cards` | Bulk-replace all cards (primary save path) |
| `PATCH` | `/api/canvas/cards/:cardId` | Update one card |
| `DELETE` | `/api/canvas/cards/:cardId` | Delete one card |

**Create:**

```json
{
  "name": "Brainstorm",
  "description": "Q3 roadmap ideas",
  "mode": "freeform",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "tags": ["ideas"],
  "background": null
}
```

`name` and `domain` are required. `GET /api/canvas/:id` returns the canvas plus `cards` (ordered by `zIndex`) and `connections`.

**Create a card** with `{ "type": "note", "title": "Idea", "content": "…", "x": 0, "y": 0, "width": 200, "height": 150, "zIndex": 1 }`. Defaults: `type` `note`, `width` 200, `height` 150, `zIndex` one past the current max.

**Bulk save** `PUT /api/canvas/:id/cards` replaces all cards in one transaction:

```json
{
  "cards": [
    { "id": "optional-existing-id", "type": "note", "content": "First card", "x": 0, "y": 0 },
    { "type": "note", "content": "Second card", "x": 240, "y": 0 }
  ]
}
```

Cards without an `id` are created; `zIndex` defaults to the array index. Response is the canvas plus the saved cards. Canvases, cards, and connections are hard-deleted (`204`).

## Daily Notes

One note per calendar day per domain (unique on `date` + `domain_id`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/daily-notes` | Get a day's note or list all for the domain |
| `POST` | `/api/daily-notes` | Create a note for a date |
| `PATCH` | `/api/daily-notes/:id` | Update a note |
| `DELETE` | `/api/daily-notes/:id` | Delete a note |

`GET /api/daily-notes?date=2026-08-10` returns the note object or `null`. Without `date`, it returns `{ items, totalItems }` ordered newest first.

**Create:**

```json
{
  "date": "2026-08-10",
  "content": "Deep work on the API docs.",
  "mood": 8,
  "energy": 7,
  "customFields": {}
}
```

`date` must be `YYYY-MM-DD`, `mood` and `energy` are 1-10. Daily notes are hard-deleted (`204`).

## Tags

Tags are global (no domain column). They attach to tasks, habits, projects, and notes through junction tables.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tags` | List tags |
| `POST` | `/api/tags` | Create a tag |
| `GET` | `/api/tags/:id` | Get a tag |
| `PATCH` | `/api/tags/:id` | Update a tag |
| `DELETE` | `/api/tags/:id` | Delete a tag |

**List query parameters:** `page`, `perPage`, `sort` (`name`, `created`, `updated`; default `name`), `filter` (exact match on scope: `global`, `tasks`, `habits`, `projects`, `notes`).

**Create:**

```json
{ "name": "urgent", "color": "#ef4444", "scope": "global" }
```

`name` is required, `scope` defaults to `global`. Tags are hard-deleted (`204`).

## Custom Fields

Per-domain field definitions attached to entities.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/custom-fields` | List fields, optionally for one entity type |
| `POST` | `/api/custom-fields` | Create a field |
| `PATCH` | `/api/custom-fields/:id` | Update a field |
| `DELETE` | `/api/custom-fields/:id` | Delete a field |

`GET /api/custom-fields?entity=task` filters by entity type (`task`, `habit`, `project`, `note`, and so on). Results are ordered by `sortOrder`, then `name`.

**Create:**

```json
{
  "name": "Client",
  "type": "text",
  "entityType": "task",
  "required": false,
  "options": [],
  "defaultValue": null,
  "sortOrder": 0
}
```

`name`, `entityType`, and `domain` are required. Fields are hard-deleted (`204`).

## Error Log

Server-side error log, useful for admin screens.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/error-log` | List recent errors |
| `DELETE` | `/api/error-log` | Clear all error logs |

`GET /api/error-log?level=error&limit=50` filters by level and caps at 200 rows (default 50). Rows carry `level`, `source`, `message`, `stackTrace`, `metadata`, `resolved`, timestamps. `DELETE` returns `{ "deleted": <count> }`.

## Analytics

All analytics endpoints accept `range` (days, default 30) and `domain`. Responses include a short `Cache-Control` header. None paginate.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/productivity` | Task completion rate over the period |
| `GET` | `/api/analytics/habits` | Habit consistency, active streaks, best streak |
| `GET` | `/api/analytics/projects` | Per-project task totals and progress |
| `GET` | `/api/analytics/daily` | Daily task created/completed time series |

**Productivity:**

```json
{
  "taskCompletionRate": 75,
  "totalTasks": 40,
  "completedTasks": 30,
  "period": 30
}
```

**Habits:**

```json
{
  "habitConsistency": 82,
  "totalHabits": 6,
  "totalLogs": 148,
  "activeStreaks": 5,
  "bestStreak": 21,
  "period": 30
}
```

**Projects:**

```json
{
  "projects": [
    { "id": "...", "name": "Website Redesign", "totalTasks": 12, "completedTasks": 9, "progress": 0.75 }
  ],
  "totalProjects": 3,
  "period": 30
}
```

**Daily** returns `{ items: [{ date: "2026-07-12", created: 2, completed: 1 }, ...], period }` with one bucket per day across the range.

## Notifications

The notification bell feed. Backed by `activity_feed`; there is no read/unread state yet, so `count` serves as the unread badge. `graph_edge` rows are excluded.

#### `GET /api/notifications`

**Query parameters:** `workspace_id` (defaults to active domain), `limit` (default 20, max 100).

Returns activity from the last 7 days, newest first:

```json
{
  "items": [
    {
      "id": "...",
      "actor": "User Name",
      "action": "completed",
      "entityType": "task",
      "entityId": "c3d4e5f6-...",
      "changes": { "previousStatus": "in_progress", "newStatus": "done" },
      "workspaceId": "b2c3d4e5-...",
      "createdAt": "2026-08-10T12:00:00.000Z"
    }
  ],
  "count": 3
}
```

## Export and Import

JSON backup and restore, scoped to one domain.

#### `GET /api/export`

Lists the exportable collections without exporting anything:

```json
{
  "collections": [
    { "name": "tasks", "label": "Tasks" },
    { "name": "habits", "label": "Habits" },
    { "name": "projects", "label": "Projects" },
    { "name": "notes", "label": "Notes" },
    { "name": "tags", "label": "Tags" },
    { "name": "agents", "label": "Agents" },
    { "name": "webhooks", "label": "Webhooks" }
  ]
}
```

#### `POST /api/export`

Body `{ "collections": ["tasks", "notes"], "domain": "<domainId>" }`. `collections` defaults to all seven; `domain` defaults to the active domain. Returns a JSON dump:

```json
{
  "version": "1.0",
  "exportedAt": "2026-08-10T10:30:00.000Z",
  "tasks": [],
  "notes": []
}
```

Tags are exported only when used by the domain's entities. Soft-deleted rows are excluded. A failed collection exports as an empty array rather than failing the whole request.

#### `POST /api/import`

Body `{ "version": "1.0", "domain": "<domainId>", "tasks": [...], "habits": [...], ... }`. `version` is required. The target domain comes from `body.domain` or `body.domain_id` (or the active domain) and every imported entity is forced into it; payload-supplied `domain_id` values on individual rows are ignored.

```json
{
  "success": true,
  "imported": 12,
  "failed": 0,
  "results": [
    { "collection": "tasks", "imported": 10, "failed": 0, "errors": [] },
    { "collection": "notes", "imported": 2, "failed": 0, "errors": [] }
  ]
}
```

`success` is true when nothing failed. Per-collection `errors` hold up to 5 messages.

## Realtime (SSE)

#### `GET /api/realtime`

Server-sent events stream backed by PostgreSQL `LISTEN/NOTIFY` on the `project_e_events` channel. Requires authentication.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `workspace_id` | string | Only forward events for this workspace. When omitted, all workspaces' events are forwarded. |

The ownership check is an IDOR guard: when `workspace_id` is supplied, the caller must own that workspace, or the request is rejected before the stream opens.

On connect the server sends a `connected` event, then forwards activity events:

```
data: {"type":"connected","workspace_id":"b2c3d4e5-..."}

data: {"type":"task","action":"created","id":"c3d4e5f6-...","workspace_id":"b2c3d4e5-..."}
```

A `:ping` comment arrives every 30 seconds to keep the connection alive. Events are plain `data:` frames, not named events. Unauthenticated requests get `401` with `{ "error": "Unauthorized" }`.

## MCP

Model Context Protocol over JSON-RPC 2.0. `POST /api/mcp` is a stateless HTTP endpoint; there are no sessions to establish. Requires an API key in the `Authorization: Bearer <apiKey>` header. The key is validated against the `api_keys` table (SHA-256 hash comparison). JWT and cookie auth are not accepted here.

Requests and responses use the JSON-RPC 2.0 envelope:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "tasks.list", "arguments": { "domain_id": "b2c3d4e5-...", "status": "todo" } },
  "id": 1
}
```

```json
{
  "jsonrpc": "2.0",
  "result": { "content": [{ "type": "text", "text": "{\"items\":[...],\"total\":3}" }] },
  "id": 1
}
```

Tool results are JSON strings inside `content[0].text`. Tool calls that pass `domain_id` or `workspace_id` are ownership-checked before execution.

**Methods:**

| Method | Purpose |
|--------|---------|
| `initialize` | Negotiate protocol version `2024-11-05`, server `project-e` v1.0.0 |
| `tools/list` | List available tools and schemas |
| `tools/call` | Invoke a tool |
| `resources/list` | List resource URIs |
| `resources/read` | Read a resource URI (stub) |
| `server/discover` | Legacy discovery: server info plus all tools |

**Tools:**

| Tool | Description |
|------|-------------|
| `tasks.list` | List tasks with optional filters |
| `tasks.create` | Create a task |
| `tasks.update` | Update a task |
| `tasks.delete` | Delete a task |
| `tasks.complete` | Mark a task done |
| `habits.list` | List habits |
| `habits.create` | Create a habit |
| `habits.complete` | Log a habit completion |
| `projects.list` | List projects |
| `projects.create` | Create a project |
| `notes.list` | List notes |
| `notes.create` | Create a note |
| `notes.update` | Update a note |
| `notes.search` | Search notes |
| `domains.list` | List domains |
| `domains.create` | Create a domain |
| `search.query` | Cross-entity search |
| `activity.list` | List activity feed entries |

**Errors** use JSON-RPC codes:

| Code | Meaning |
|------|---------|
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method or tool not found |
| `-32602` | Invalid params (including missing required args) |
| `-32603` | Internal error |
| `-32001` | Unauthorized (missing or invalid API key, HTTP 401) |

`GET /api/mcp` returns HTTP 405; the endpoint only accepts POST.

## Rate Limiting

The API does not enforce rate limiting at the application level. Configure limits at the reverse proxy or infrastructure layer.
