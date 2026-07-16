# MCP Server Documentation

Project E includes a native Model Context Protocol (MCP) server that lets AI agents read and write data through a standardized interface. The server exposes 61 tools organized across 11 categories.

## Table of Contents

- [Overview](#overview)
- [Connection](#connection)
- [Authentication](#authentication)
- [Transport](#transport)
- [Tools](#tools)
  - [Tasks (8 tools)](#tasks-8-tools)
  - [Habits (7 tools)](#habits-7-tools)
  - [Projects (6 tools)](#projects-6-tools)
  - [Notes (6 tools)](#notes-6-tools)
  - [Reports (5 tools)](#reports-5-tools)
  - [Milestones (5 tools)](#milestones-5-tools)
  - [Domains (5 tools)](#domains-5-tools)
  - [Tags (5 tools)](#tags-5-tools)
  - [Agents (5 tools)](#agents-5-tools)
  - [Webhooks (5 tools)](#webhooks-5-tools)
  - [Analytics (4 tools)](#analytics-4-tools)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Overview

The MCP server runs inside the Next.js application at `/api/mcp`. It uses the Streamable HTTP transport from the `@modelcontextprotocol/sdk` package.

AI agents connect to the server using their API key, then call tools to interact with Project E data. Every tool call is authenticated and attributed to the calling agent.

## Connection

### Endpoint

```
GET  /api/mcp   : Establish a session
POST /api/mcp   : Send tool calls
DELETE /api/mcp : End the session
```

### Connection Flow

1. Agent sends `GET /api/mcp` with `Authorization: Bearer <api_key>` header
2. Server validates the API key and returns a session ID in the `mcp-session-id` response header
3. Agent includes `mcp-session-id` in all subsequent `POST` requests
4. Agent sends `DELETE /api/mcp` with the session ID to close the connection

### Session Management

Sessions are stored in memory on the server. If the server restarts, active sessions are lost and agents must reconnect.

Sessions do not expire automatically. Send a `DELETE` request to clean up.

## Authentication

All MCP requests require an API key in the `Authorization` header:

```
Authorization: Bearer your_agent_api_key
```

API keys are generated when you create an agent through the web UI or the `create_agent` tool. Each agent has a unique key tied to its permission tier.

### Permission Tiers

| Tier | Access |
|------|--------|
| `full_access` | All tools |
| `read_only` | `get_*` and `list_*` tools only |
| `content_creator` | Read tools + `create_note`, `create_report` |
| `task_manager` | Read tools + all task and habit tools |
| `custom` | Defined by `custom_permissions` field |

The server validates the API key against the `agents` collection. Disabled agents cannot connect.

## Transport

The server uses **Streamable HTTP** transport. This is a request-response protocol over HTTP with server-sent events for streaming responses.

### Capabilities

The server advertises the `tools` capability. Agents can list available tools and call them by name.

### Message Format

Tool calls follow the MCP JSON-RPC format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_task",
    "arguments": {
      "title": "New task",
      "domain": "work"
    }
  }
}
```

Responses:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"task\":{...}}"
      }
    ]
  }
}
```

## Tools

All tools return a JSON object with a `success` boolean. On success, the response includes the created or fetched data. On failure, the response includes an `error` string.

### Tasks (8 tools)

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task |
| `get_task` | Get a task by ID |
| `list_tasks` | List tasks with optional filters |
| `update_task` | Update an existing task |
| `delete_task` | Delete a task |
| `bulk_create_tasks` | Create multiple tasks at once |
| `bulk_update_tasks` | Update multiple tasks at once |
| `bulk_delete_tasks` | Delete multiple tasks at once |

#### `create_task`

Create a new task.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | yes | Task title |
| `description` | string | no | Task description |
| `status` | enum | no | `todo`, `in_progress`, `done`, `cancelled` (default: `todo`) |
| `priority` | enum | no | `low`, `medium`, `high`, `urgent` (default: `medium`) |
| `due_date` | string | no | ISO 8601 date string |
| `project_id` | string | no | Related project ID |
| `milestone_id` | string | no | Related milestone ID |
| `tags` | string[] | no | Array of tag IDs |
| `domain` | string | yes | Domain ID |
| `assignee` | string | no | Assignee user ID |
| `estimate` | number | no | Time estimate in minutes |

**Example:**

```json
{
  "name": "create_task",
  "arguments": {
    "title": "Write API documentation",
    "description": "Document all REST endpoints",
    "priority": "high",
    "domain": "work_id",
    "tags": ["tag_docs", "tag_api"],
    "due_date": "2024-02-01T00:00:00.000Z"
  }
}
```

#### `list_tasks`

List tasks with optional filters.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `status` | enum | no | Filter by status |
| `priority` | enum | no | Filter by priority |
| `project_id` | string | no | Filter by project |
| `milestone_id` | string | no | Filter by milestone |
| `domain` | string | no | Filter by domain |
| `limit` | number | no | Items per page (default: 20) |
| `offset` | number | no | Offset for pagination |

**Response:**

```json
{
  "success": true,
  "tasks": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### `bulk_create_tasks`

Create multiple tasks in one call.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tasks` | object[] | yes | Array of task objects |

Each task object accepts the same fields as `create_task` (minus `domain` being required per task).

**Response:**

```json
{
  "success": true,
  "created": [...],
  "count": 5
}
```

### Habits (7 tools)

| Tool | Description |
|------|-------------|
| `create_habit` | Create a new habit |
| `get_habit` | Get a habit by ID |
| `list_habits` | List habits with optional filters |
| `update_habit` | Update an existing habit |
| `delete_habit` | Delete a habit |
| `log_habit_completion` | Log a habit completion |
| `get_habit_streaks` | Get streak information for all active habits |

#### `create_habit`

Create a new habit.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Habit name |
| `description` | string | no | Habit description |
| `domain` | string | yes | Domain ID |
| `frequency` | enum | no | `daily`, `weekly`, `custom` (default: `daily`) |
| `difficulty` | enum | no | `easy`, `medium`, `hard` (default: `medium`) |
| `goal_per_period` | number | no | Target completions per period (default: 1) |
| `tags` | string[] | no | Array of tag IDs |

#### `log_habit_completion`

Log a habit completion and update streaks.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `habit_id` | string | yes | Habit ID |
| `completed` | boolean | no | Whether completed (default: true) |
| `notes` | string | no | Completion notes |
| `value` | number | no | Quantity value |
| `mood` | number | no | Mood rating (1-5) |
| `logged_at` | string | no | ISO 8601 timestamp (default: now) |

**Response:**

```json
{
  "success": true,
  "log": {...},
  "habit_id": "habit_id",
  "current_streak": 7
}
```

#### `get_habit_streaks`

Get streak information for all active habits. No arguments required.

**Response:**

```json
{
  "success": true,
  "streaks": [
    {
      "habit_id": "id",
      "name": "Meditation",
      "current_streak": 14,
      "best_streak": 21,
      "total_completions": 45,
      "score": 85
    }
  ]
}
```

### Projects (6 tools)

| Tool | Description |
|------|-------------|
| `create_project` | Create a new project |
| `get_project` | Get a project by ID |
| `list_projects` | List projects with optional filters |
| `update_project` | Update an existing project |
| `delete_project` | Delete a project |
| `get_project_progress` | Get project progress based on task completion |

#### `create_project`

Create a new project.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Project name |
| `description` | string | no | Project description |
| `status` | enum | no | `active`, `paused`, `archived` (default: `active`) |
| `domain` | string | yes | Domain ID |
| `color` | string | no | Hex color code |
| `icon` | string | no | Icon name |
| `tags` | string[] | no | Array of tag IDs |
| `owner` | string | no | Owner user ID |
| `start_date` | string | no | ISO 8601 date |
| `target_date` | string | no | ISO 8601 date |

#### `get_project_progress`

Calculate project progress based on task completion.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `project_id` | string | yes | Project ID |

**Response:**

```json
{
  "success": true,
  "project_id": "project_id",
  "total_tasks": 20,
  "completed_tasks": 15,
  "progress": 75
}
```

### Notes (6 tools)

| Tool | Description |
|------|-------------|
| `create_note` | Create a new note |
| `get_note` | Get a note by ID |
| `list_notes` | List notes with optional filters |
| `update_note` | Update an existing note |
| `delete_note` | Delete a note |
| `get_note_graph` | Get the note graph showing connections between notes |

#### `create_note`

Create a new note. Word count is calculated automatically from content.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | yes | Note title |
| `content` | string | no | Note content (markdown) |
| `domain` | string | yes | Domain ID |
| `tags` | string[] | no | Array of tag IDs |
| `project_id` | string | no | Related project ID |
| `is_pinned` | boolean | no | Pin the note (default: false) |

#### `get_note_graph`

Get the full note graph with all notes and their links. No arguments required.

**Response:**

```json
{
  "success": true,
  "graph": {
    "nodes": [
      { "id": "note_id", "title": "Note Title", "domain": "domain_id" }
    ],
    "edges": [
      { "source": "note_1", "target": "note_2", "label": "related to" }
    ]
  }
}
```

### Reports (5 tools)

| Tool | Description |
|------|-------------|
| `create_report` | Create a new report |
| `get_report` | Get a report by ID |
| `list_reports` | List reports with optional filters |
| `update_report` | Update an existing report |
| `delete_report` | Delete a report |

#### `create_report`

Create a new report.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | string | yes | Report title |
| `type` | enum | yes | `weekly`, `monthly`, `project`, `habit`, `custom` |
| `domain` | string | yes | Domain ID |
| `date_range_start` | string | yes | ISO 8601 date |
| `date_range_end` | string | yes | ISO 8601 date |
| `summary` | string | no | Report summary |
| `tags` | string[] | no | Array of tag IDs |
| `is_draft` | boolean | no | Save as draft (default: true) |

### Milestones (5 tools)

| Tool | Description |
|------|-------------|
| `create_milestone` | Create a new milestone |
| `get_milestone` | Get a milestone by ID |
| `list_milestones` | List milestones with optional filters |
| `update_milestone` | Update an existing milestone |
| `delete_milestone` | Delete a milestone |

#### `create_milestone`

Create a new milestone.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Milestone name |
| `description` | string | no | Milestone description |
| `project_id` | string | yes | Parent project ID |
| `domain` | string | yes | Domain ID |
| `status` | enum | no | `planned`, `in_progress`, `complete` (default: `planned`) |
| `target_date` | string | no | ISO 8601 date |
| `sort_order` | number | no | Display order (default: 0) |
| `tags` | string[] | no | Array of tag IDs |

#### `update_milestone`

When status is set to `complete`, the server automatically sets `completed_at` to the current timestamp.

### Domains (5 tools)

| Tool | Description |
|------|-------------|
| `create_domain` | Create a new domain |
| `get_domain` | Get a domain by ID |
| `list_domains` | List all domains |
| `update_domain` | Update an existing domain |
| `delete_domain` | Delete a domain |

#### `create_domain`

Create a new domain.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Domain name |
| `color` | string | no | Hex color code |
| `icon` | string | no | Icon name |
| `sort_order` | number | no | Display order (default: 0) |

### Tags (5 tools)

| Tool | Description |
|------|-------------|
| `create_tag` | Create a new tag |
| `get_tag` | Get a tag by ID |
| `list_tags` | List all tags |
| `update_tag` | Update an existing tag |
| `delete_tag` | Delete a tag |

#### `create_tag`

Create a new tag.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Tag name |
| `color` | string | no | Hex color code |

### Agents (5 tools)

| Tool | Description |
|------|-------------|
| `create_agent` | Create a new agent |
| `get_agent` | Get an agent by ID |
| `list_agents` | List agents with optional filters |
| `update_agent` | Update an existing agent |
| `delete_agent` | Delete an agent |

#### `create_agent`

Create a new agent. The server generates an API key automatically.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Agent name |
| `description` | string | no | Agent description |
| `domain` | string | yes | Domain ID |
| `status` | enum | no | `active`, `disabled` (default: `active`) |
| `permission_tier` | enum | no | `full_access`, `read_only`, `content_creator`, `task_manager`, `custom` (default: `read_only`) |
| `tags` | string[] | no | Array of tag IDs |

**Response:**

```json
{
  "success": true,
  "agent": {
    "id": "agent_id",
    "name": "Code Assistant",
    "api_key": "generated-uuid-key",
    "permission_tier": "read_only",
    "status": "active"
  }
}
```

Save the `api_key` from the response. It is not shown again.

### Webhooks (5 tools)

| Tool | Description |
|------|-------------|
| `create_webhook` | Create a new webhook |
| `get_webhook` | Get a webhook by ID |
| `list_webhooks` | List webhooks with optional filters |
| `update_webhook` | Update an existing webhook |
| `delete_webhook` | Delete a webhook |

#### `create_webhook`

Create a new webhook subscription.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Webhook name |
| `url` | string | yes | Delivery URL |
| `events` | string[] | yes | Event types to subscribe to |
| `domain` | string | yes | Domain ID |
| `secret` | string | no | HMAC secret for payload signing |
| `active` | boolean | no | Enable webhook (default: true) |
| `retry_count` | number | no | Max retry attempts (default: 3) |

### Analytics (4 tools)

| Tool | Description |
|------|-------------|
| `get_analytics` | Get analytics data for a given period |
| `get_time_summary` | Get aggregated time tracking summary |
| `search` | Search across tasks, habits, projects, notes, and reports |
| `get_agent_activity` | Get recent agent activity |

#### `get_analytics`

Get analytics data for a given period.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `period_days` | number | no | Number of days to analyze (default: 30) |

**Response:**

```json
{
  "success": true,
  "analytics": {
    "taskCompletionRate": 75,
    "habitConsistency": 82,
    "totalTimeMinutes": 1240,
    "activeStreaks": 5,
    "bestStreak": 21,
    "period": 30
  }
}
```

#### `get_time_summary`

Get aggregated time tracking data broken down by domain, project, and tag.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | no | Start date (default: 30 days ago) |
| `end_date` | string | no | End date (default: now) |

**Response:**

```json
{
  "success": true,
  "time_summary": {
    "totalMinutes": 1240,
    "byDomain": { "work": 800, "personal": 440 },
    "byProject": { "project_id_1": 600 },
    "byTag": { "frontend": 300 },
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-31T00:00:00.000Z"
  }
}
```

#### `search`

Full-text search across multiple entity types.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Search query |
| `types` | string[] | no | Entity types to search (default: all) |
| `limit` | number | no | Max results per type (default: 10) |

Supported types: `tasks`, `habits`, `projects`, `notes`, `reports`.

**Response:**

```json
{
  "success": true,
  "results": [
    { "type": "tasks", "items": [...] },
    { "type": "notes", "items": [...] }
  ]
}
```

#### `get_agent_activity`

Get recent agent activity logs.

**Arguments:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | no | Items per page (default: 20) |
| `offset` | number | no | Offset for pagination |

## Error Handling

All tools catch errors and return them in a consistent format:

**Success:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\":true,\"task\":{...}}"
    }
  ]
}
```

**Failure:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\":false,\"error\":\"ClientResponseError: The requested resource wasn't found.\"}"
    }
  ]
}
```

Tools never throw exceptions. Errors are returned as text content with `success: false`.

### Common Errors

| Error | Cause |
|-------|-------|
| `Unauthorized` | Missing or invalid API key |
| `Session not found` | Session expired or never created |
| `The requested resource wasn't found` | Invalid record ID |
| `Failed to parse request body` | Invalid JSON in tool arguments |

## Examples

### Python Client

```python
import requests

API_URL = "http://localhost:3000/api/mcp"
API_KEY = "your-agent-api-key"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Step 1: Establish session
response = requests.get(API_URL, headers=headers)
session_id = response.headers.get("mcp-session-id")
headers["mcp-session-id"] = session_id

# Step 2: List available tools
list_tools = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
}
response = requests.post(API_URL, headers=headers, json=list_tools)
tools = response.json()

# Step 3: Create a task
create_task = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "create_task",
        "arguments": {
            "title": "Review pull request",
            "domain": "work_domain_id",
            "priority": "high",
        },
    },
}
response = requests.post(API_URL, headers=headers, json=create_task)
result = response.json()

# Step 4: Close session
requests.delete(API_URL, headers=headers)
```

### JavaScript Client (using MCP SDK)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const API_URL = "http://localhost:3000/api/mcp";
const API_KEY = "your-agent-api-key";

const transport = new StreamableHTTPClientTransport(
  new URL(API_URL),
  { requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } } }
);

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(transport);

// List tools
const { tools } = await client.listTools();
console.log(`Available tools: ${tools.length}`);

// Create a task
const result = await client.callTool({
  name: "create_task",
  arguments: {
    title: "Review pull request",
    domain: "work_domain_id",
    priority: "high",
  },
});
console.log(result);

// Close connection
await client.close();
```

### cURL

```bash
# Establish session
curl -X GET http://localhost:3000/api/mcp \
  -H "Authorization: Bearer your-api-key" \
  -D headers.txt

# Extract session ID from headers
SESSION_ID=$(grep -i 'mcp-session-id' headers.txt | awk '{print $2}' | tr -d '\r')

# Create a task
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer your-api-key" \
  -H "mcp-session-id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_task",
      "arguments": {
        "title": "New task",
        "domain": "work_domain_id"
      }
    }
  }'

# Close session
curl -X DELETE http://localhost:3000/api/mcp \
  -H "Authorization: Bearer your-api-key" \
  -H "mcp-session-id: $SESSION_ID"
```
