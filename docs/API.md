# API Documentation

Project E exposes a REST API through Next.js API routes. All endpoints live under `/api/` and communicate via JSON.

## Table of Contents

- [Authentication](#authentication)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Filtering and Sorting](#filtering-and-sorting)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Tasks](#tasks)
  - [Habits](#habits)
  - [Projects](#projects)
  - [Notes](#notes)
  - [Reports](#reports)
  - [Milestones](#milestones)
  - [Domains](#domains)
  - [Tags](#tags)
  - [Agents](#agents)
  - [Webhooks](#webhooks)
  - [Analytics](#analytics)
  - [Realtime](#realtime)
  - [MCP](#mcp)

## Authentication

All API endpoints (except `/api/health` and `/api/auth/login`) require authentication.

### Session-Based Auth

The web app uses cookie-based sessions. After login, the server sets an `httpOnly` cookie named `pb_auth` containing a PocketBase JWT token.

**Login:**

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "eyJhbGciOi..."
}
```

The `Set-Cookie` header includes the `pb_auth` cookie. Include this cookie in subsequent requests.

### Token Refresh

Tokens expire after 7 days. Refresh before expiry:

```bash
POST /api/auth/refresh
Cookie: pb_auth=eyJhbGciOi...
```

### Current User

```bash
GET /api/auth/me
Cookie: pb_auth=eyJhbGciOi...
```

**Response:**

```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name"
}
```

### Logout

```bash
POST /api/auth/logout
Cookie: pb_auth=eyJhbGciOi...
```

Clears the `pb_auth` cookie.

## Request Format

All write endpoints (`POST`, `PATCH`, `PUT`) expect JSON bodies with `Content-Type: application/json`.

Request bodies are validated with Zod schemas from `@project-e/shared`. Invalid input returns a `400 VALIDATION_ERROR`.

## Response Format

Successful responses return JSON with appropriate HTTP status codes:

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (delete) |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized |
| `404` | Not Found |
| `500` | Internal Server Error |

List endpoints return paginated results:

```json
{
  "items": [...],
  "totalItems": 42,
  "totalPages": 3,
  "page": 1,
  "perPage": 20
}
```

## Error Handling

Errors follow a consistent structure:

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

Error codes:

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `NOT_FOUND` | 404 | Resource does not exist |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Pagination

List endpoints accept query parameters for pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `perPage` | number | 50 | Items per page (max 200) |

**Example:**

```bash
GET /api/tasks?page=2&perPage=20
```

## Filtering and Sorting

### Filtering

Use the `filter` query parameter with PocketBase filter syntax:

```bash
GET /api/tasks?filter=status = "todo" && priority = "high"
```

Filter operators:

| Operator | Description |
|----------|-------------|
| `=` | Equal |
| `!=` | Not equal |
| `>`, `>=`, `<`, `<=` | Comparison |
| `~` | Contains (case-insensitive) |
| `!~` | Not contains |
| `^` | Starts with |
| `@` | Full-text search |
| `&&` | AND |
| `\|\|` | OR |

### Sorting

Use the `sort` query parameter. Prefix with `-` for descending order:

```bash
GET /api/tasks?sort=-created
GET /api/tasks?sort=priority,-due_date
```

## Endpoints

### Health

#### `GET /api/health`

Returns server health status. No authentication required.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.1.0"
}
```

### Auth

#### `POST /api/auth/login`

Authenticate a user and create a session.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "eyJhbGciOi..."
}
```

#### `POST /api/auth/logout`

End the current session. Requires authentication.

#### `GET /api/auth/me`

Get the current authenticated user. Requires authentication.

#### `POST /api/auth/refresh`

Refresh the auth token. Requires authentication.

### Tasks

#### `GET /api/tasks`

List tasks with filtering, sorting, and pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `perPage` | number | Items per page |
| `filter` | string | PocketBase filter expression |
| `sort` | string | Sort field(s) |

**Example:**

```bash
GET /api/tasks?filter=status = "todo"&sort=-priority
```

**Response:**

```json
{
  "items": [
    {
      "id": "task_id",
      "title": "Complete documentation",
      "description": "Write API docs",
      "status": "todo",
      "priority": "high",
      "due_date": "2024-01-20T00:00:00.000Z",
      "project_id": "project_id",
      "tags": ["docs", "api"],
      "domain": "work",
      "subtasks": [],
      "attachments": [],
      "created": "2024-01-15T10:00:00.000Z",
      "updated": "2024-01-15T10:00:00.000Z"
    }
  ],
  "totalItems": 1,
  "totalPages": 1,
  "page": 1,
  "perPage": 50
}
```

#### `POST /api/tasks`

Create a new task.

**Request:**

```json
{
  "title": "Complete documentation",
  "description": "Write API docs",
  "status": "todo",
  "priority": "high",
  "due_date": "2024-01-20T00:00:00.000Z",
  "project_id": "project_id",
  "tags": ["docs", "api"],
  "domain": "work"
}
```

**Required fields:** `title`, `domain`

**Response (201):** Returns the created task.

#### `GET /api/tasks/[id]`

Get a single task by ID.

**Response:** Returns the task object.

#### `PATCH /api/tasks/[id]`

Update a task. Send only the fields you want to change.

**Request:**

```json
{
  "status": "in_progress",
  "priority": "urgent"
}
```

**Response:** Returns the updated task.

#### `DELETE /api/tasks/[id]`

Delete a task. Returns `204 No Content`.

#### `POST /api/tasks/bulk`

Bulk operations on tasks.

**Request (bulk update):**

```json
{
  "action": "update",
  "task_ids": ["id1", "id2", "id3"],
  "data": {
    "status": "done"
  }
}
```

**Request (bulk delete):**

```json
{
  "action": "delete",
  "task_ids": ["id1", "id2", "id3"]
}
```

### Habits

#### `GET /api/habits`

List habits with filtering and pagination.

**Query Parameters:** Same as tasks.

**Response:** Paginated list of habit objects.

#### `POST /api/habits`

Create a new habit.

**Request:**

```json
{
  "title": "Morning meditation",
  "description": "10 minutes of mindfulness",
  "frequency": "daily",
  "domain": "health",
  "difficulty": "medium",
  "target_count": 1,
  "tags": ["wellness"]
}
```

**Required fields:** `title`, `domain`

**Response (201):** Returns the created habit.

#### `GET /api/habits/[id]`

Get a single habit by ID.

#### `PATCH /api/habits/[id]`

Update a habit.

#### `DELETE /api/habits/[id]`

Delete a habit.

#### `GET /api/habit-logs`

List habit completion logs.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `habit_id` | string | Filter by habit |
| `date` | string | Filter by date |

#### `POST /api/habit-logs`

Log a habit completion.

**Request:**

```json
{
  "habit_id": "habit_id",
  "date": "2024-01-15",
  "mood": "good",
  "quantity": 1,
  "notes": "Felt great"
}
```

### Projects

#### `GET /api/projects`

List projects.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`active`, `paused`, `archived`) |
| `domain` | string | Filter by domain |

#### `POST /api/projects`

Create a new project.

**Request:**

```json
{
  "name": "Website Redesign",
  "description": "Complete overhaul of the company website",
  "domain": "work",
  "status": "active",
  "color": "#3b82f6",
  "tags": ["design", "frontend"]
}
```

**Required fields:** `name`, `domain`

#### `GET /api/projects/[id]`

Get a single project.

#### `PATCH /api/projects/[id]`

Update a project.

#### `DELETE /api/projects/[id]`

Delete a project.

### Notes

#### `GET /api/notes`

List notes.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | string | Filter by domain |
| `is_pinned` | boolean | Filter by pinned status |
| `is_archived` | boolean | Filter by archived status |

#### `POST /api/notes`

Create a new note.

**Request:**

```json
{
  "title": "Meeting Notes",
  "content": "# Meeting with design team\n\nDiscussed new layout...",
  "domain": "work",
  "tags": ["meetings"],
  "is_pinned": false
}
```

**Required fields:** `title`, `domain`

#### `GET /api/notes/[id]`

Get a single note.

#### `PATCH /api/notes/[id]`

Update a note.

#### `DELETE /api/notes/[id]`

Delete a note.

### Reports

#### `GET /api/reports`

List reports.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type (`weekly`, `monthly`, `project`, `habit`, `custom`) |
| `domain` | string | Filter by domain |

#### `POST /api/reports`

Create a new report.

**Request:**

```json
{
  "title": "Weekly Summary",
  "report_type": "weekly",
  "domain": "work",
  "date_range_start": "2024-01-08T00:00:00.000Z",
  "date_range_end": "2024-01-14T23:59:59.999Z",
  "content": "# Week of Jan 8-14\n\nCompleted 15 tasks..."
}
```

**Required fields:** `title`, `report_type`, `domain`

#### `GET /api/reports/[id]`

Get a single report.

#### `PATCH /api/reports/[id]`

Update a report.

#### `DELETE /api/reports/[id]`

Delete a report.

### Milestones

#### `GET /api/milestones`

List milestones.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | string | Filter by project |
| `status` | string | Filter by status (`planned`, `in_progress`, `complete`) |

#### `POST /api/milestones`

Create a new milestone.

**Request:**

```json
{
  "title": "Design Phase",
  "description": "Complete all design mockups",
  "project_id": "project_id",
  "status": "in_progress",
  "due_date": "2024-02-01T00:00:00.000Z",
  "sort_order": 1
}
```

**Required fields:** `title`, `project_id`

#### `GET /api/milestones/[id]`

Get a single milestone.

#### `PATCH /api/milestones/[id]`

Update a milestone.

#### `DELETE /api/milestones/[id]`

Delete a milestone.

### Domains

#### `GET /api/domains`

List all domains.

**Response:**

```json
{
  "items": [
    {
      "id": "domain_id",
      "name": "Work",
      "color": "#3b82f6",
      "icon": "briefcase",
      "sort_order": 1
    }
  ],
  "totalItems": 3,
  "page": 1,
  "perPage": 50
}
```

#### `POST /api/domains`

Create a new domain.

**Request:**

```json
{
  "name": "Work",
  "color": "#3b82f6",
  "icon": "briefcase",
  "sort_order": 1
}
```

**Required fields:** `name`

#### `GET /api/domains/[id]`

Get a single domain.

#### `PATCH /api/domains/[id]`

Update a domain.

#### `DELETE /api/domains/[id]`

Delete a domain.

### Tags

#### `GET /api/tags`

List all tags.

#### `POST /api/tags`

Create a new tag.

**Request:**

```json
{
  "name": "urgent",
  "color": "#ef4444"
}
```

**Required fields:** `name`

#### `GET /api/tags/[id]`

Get a single tag.

#### `PATCH /api/tags/[id]`

Update a tag.

#### `DELETE /api/tags/[id]`

Delete a tag.

### Agents

#### `GET /api/agents`

List agents.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (`active`, `disabled`) |

#### `POST /api/agents`

Create a new agent.

**Request:**

```json
{
  "name": "Code Assistant",
  "description": "Helps with code reviews and suggestions",
  "permission_tier": "read_only",
  "webhook_url": "https://example.com/webhook",
  "status": "active"
}
```

**Required fields:** `name`

The server generates an `api_key` automatically.

#### `GET /api/agents/[id]`

Get a single agent.

#### `PATCH /api/agents/[id]`

Update an agent.

#### `DELETE /api/agents/[id]`

Delete an agent.

#### `GET /api/agent-activity`

List recent agent activity.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent_id` | string | Filter by agent |
| `limit` | number | Max results |

#### `POST /api/agent-webhook`

Webhook endpoint for agent callbacks. Agents POST results here.

**Request:**

```json
{
  "task_id": "agent_task_id",
  "status": "completed",
  "result": {
    "summary": "Task completed successfully"
  }
}
```

### Webhooks

#### `GET /api/webhooks`

List webhooks.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `active` | boolean | Filter by active status |

#### `POST /api/webhooks`

Create a new webhook.

**Request:**

```json
{
  "name": "Task Notifications",
  "url": "https://example.com/webhook",
  "events": ["task.created", "task.updated", "task.completed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

**Required fields:** `name`, `url`, `events`

#### `GET /api/webhooks/[id]`

Get a single webhook.

#### `PATCH /api/webhooks/[id]`

Update a webhook.

#### `DELETE /api/webhooks/[id]`

Delete a webhook.

#### `GET /api/webhook-deliveries`

List webhook delivery attempts.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `webhook_id` | string | Filter by webhook |
| `success` | boolean | Filter by success status |

### Analytics

#### `GET /api/analytics`

Get analytics data.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `period_days` | number | Number of days to analyze (default: 30) |

**Response:**

```json
{
  "taskCompletionRate": 75,
  "habitConsistency": 82,
  "totalTimeMinutes": 1240,
  "activeStreaks": 5,
  "bestStreak": 21,
  "period": 30
}
```

#### `GET /api/time-summary`

Get aggregated time tracking summary.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | Start date (ISO 8601) |
| `end_date` | string | End date (ISO 8601) |

**Response:**

```json
{
  "totalMinutes": 1240,
  "byDomain": {
    "work": 800,
    "personal": 440
  },
  "byProject": {
    "project_id_1": 600,
    "project_id_2": 640
  },
  "byTag": {
    "frontend": 300,
    "backend": 500
  }
}
```

### Realtime

#### `GET /api/realtime`

Server-sent events endpoint for realtime data updates. Requires authentication.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `collections` | string | Comma-separated list of collections to subscribe to |

**Example:**

```bash
GET /api/realtime?collections=tasks,habits
```

If no collections specified, subscribes to: `tasks`, `habits`, `projects`, `notes`, `reports`, `milestones`, `notifications`.

**Event format:**

```
data: {"type":"connected","collections":["tasks","habits"]}

data: {"type":"create","collection":"tasks","record":{"id":"...","title":"..."}}

data: {"type":"update","collection":"tasks","record":{"id":"...","status":"done"}}

data: {"type":"delete","collection":"tasks","record":{"id":"..."}}

:ping
```

The server sends a `:ping` comment every 30 seconds to keep the connection alive.

### MCP

#### `GET /api/mcp`

MCP server endpoint using Streamable HTTP transport. Requires API key authentication.

**Authentication:**

```bash
Authorization: Bearer your_agent_api_key
```

The server validates the API key against the `agents` collection.

**Session management:**

1. Client sends `GET /api/mcp` to establish a session
2. Server responds with `mcp-session-id` header
3. Client includes `mcp-session-id` in subsequent `POST` and `DELETE` requests
4. Client sends `DELETE /api/mcp` to end the session

See [MCP Documentation](MCP.md) for the full list of 61 available tools.

## Rate Limiting

The API does not enforce rate limiting at the application level. Configure rate limiting at the reverse proxy or infrastructure layer.

Recommended limits:
- Auth endpoints: 10 requests per minute per IP
- Write endpoints: 100 requests per minute per user
- Read endpoints: 500 requests per minute per user

## SDK Usage

### JavaScript/TypeScript

```typescript
const API_URL = 'http://localhost:3000/api';

// Login
const loginResponse = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password' }),
});
const { token } = await loginResponse.json();

// List tasks
const tasksResponse = await fetch(`${API_URL}/tasks?filter=status = "todo"`, {
  headers: { Cookie: `pb_auth=${token}` },
});
const { items: tasks } = await tasksResponse.json();

// Create a task
const createResponse = await fetch(`${API_URL}/tasks`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: `pb_auth=${token}`,
  },
  body: JSON.stringify({
    title: 'New task',
    domain: 'work',
    priority: 'high',
  }),
});
const task = await createResponse.json();
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# List tasks
curl http://localhost:3000/api/tasks \
  -b cookies.txt

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"New task","domain":"work","priority":"high"}'
```
