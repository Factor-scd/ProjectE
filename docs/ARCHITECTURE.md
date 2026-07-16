# Architecture Documentation

Project E is a monorepo application built on Next.js with PocketBase as the data layer. This document explains the system design, data flow, and key architectural decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Three-Layer Architecture](#three-layer-architecture)
- [Data Flow](#data-flow)
- [Realtime Architecture](#realtime-architecture)
- [Worker Architecture](#worker-architecture)
- [MCP Server Architecture](#mcp-server-architecture)
- [Security](#security)
- [Performance](#performance)
- [Accessibility](#accessibility)

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                            │
│  Next.js (React 19) · Zustand · SSE Client · PocketBase SDK         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              REST API               SSE /api/realtime
              /api/*                 (PocketBase events)
                    │                     │
┌───────────────────▼─────────────────────▼────────────────────────────┐
│                     Next.js Server (apps/web)                         │
│                                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ API Routes   │  │ MCP Server   │  │ Auth        │  │ Middleware │ │
│  │ (CRUD ops)   │  │ (61 tools)   │  │ (cookies)   │  │ (routing)  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  └───────────┘ │
│         │                │                  │                         │
│  ┌──────▼────────────────▼──────────────────▼──────────────────────┐ │
│  │                    Service Layer                                 │ │
│  │  task-service · habit-service · note-service · report-service   │ │
│  │  webhook-service · agent-mention-service · project-service      │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                        │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                    PocketBase Client                             │ │
│  │  createPocketBaseClient() · createAdminClient()                 │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                     PocketBase (SQLite)                               │
│  Auth · Collections · Realtime · File Storage · Admin UI             │
│  30+ collections: tasks, habits, projects, notes, reports, ...      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     Background Worker                                 │
│  Polls queue_jobs collection · Exponential backoff · 5 job types    │
│  webhook_delivery · agent_mention · report_generation               │
│  recurring_task · cleanup                                            │
└──────────────────────────────────────────────────────────────────────┘
```

## Three-Layer Architecture

The application separates concerns into three layers.

### Presentation Layer

**Location:** `apps/web/app/` (pages) and `apps/web/components/` (UI)

The presentation layer handles rendering, user interaction, and client-side state.

**Key components:**

- **Pages**: Next.js App Router pages organized by route groups: `(auth)` for login/signup, `(dashboard)` for the main application
- **UI Components**: shadcn/ui primitives in `components/ui/`, feature components in `components/`
- **Client State**: Zustand stores in `lib/stores/` manage UI state (sidebar, filters, theme, timer)
- **Hooks**: Custom hooks in `hooks/` encapsulate reusable logic

The presentation layer communicates with the business logic layer through:
1. REST API calls (fetch to `/api/*`)
2. Zustand store actions (which call the API)
3. SSE events from the realtime endpoint

### Business Logic Layer

**Location:** `apps/web/lib/services/` and `packages/shared/`

The business logic layer handles validation, data transformation, and orchestration.

**Services:**

| Service | Responsibility |
|---------|---------------|
| `task-service` | Task CRUD, recurring task spawning, dependency resolution |
| `habit-service` | Habit tracking, streak calculation, completion scoring |
| `note-service` | Note CRUD, wikilink parsing, word count |
| `report-service` | Report generation, template rendering |
| `project-service` | Project progress calculation, milestone tracking |
| `webhook-service` | Webhook event dispatch, delivery tracking |
| `agent-mention-service` | Agent @mention parsing, task dispatch |

**Shared package (`@project-e/shared`):**

Contains Zod schemas and TypeScript types shared between the web app, worker, and potentially other consumers. Every entity has:
- A Zod schema for runtime validation
- Inferred TypeScript types for compile-time safety
- Create and update schema variants (omit server-generated fields)

### Data Access Layer

**Location:** `apps/web/lib/pocketbase.ts` and `apps/web/app/api/`

The data access layer handles communication with PocketBase.

**PocketBase client (`lib/pocketbase.ts`):**

Provides two factory functions:
- `createPocketBaseClient(token?)`: Creates a client with optional user auth
- `createAdminClient()`: Creates a client with admin privileges (uses `POCKETBASE_ADMIN_TOKEN`)

Also provides generic helpers: `getRecord`, `listRecords`, `createRecord`, `updateRecord`, `deleteRecord`.

**API routes (`app/api/`):**

Each entity has a directory under `app/api/` with a `route.ts` file implementing GET (list) and POST (create). Dynamic routes use `[id]/route.ts` for GET (single), PATCH (update), and DELETE.

All API routes use the `withAuth` middleware to enforce authentication.

## Data Flow

### Creating a Task

```
User fills form → React component
    │
    ▼
POST /api/tasks (JSON body)
    │
    ▼
withAuth middleware validates session
    │
    ▼
Zod schema validates body (createTaskSchema)
    │
    ▼
PocketBase client creates record
    │
    ▼
PocketBase triggers realtime event
    │
    ├──▶ SSE /api/realtime → Browser updates UI
    │
    └──▶ Worker picks up job (if webhook subscribed)
```

### Realtime Update Flow

```
User A updates a task
    │
    ▼
PATCH /api/tasks/abc123
    │
    ▼
PocketBase updates SQLite record
    │
    ▼
PocketBase emits realtime event
    │
    ├──▶ User A's SSE connection receives event → UI updates
    │
    ├──▶ User B's SSE connection receives event → UI updates
    │
    └──▶ Webhook delivery queued (if subscribed)
```

### Agent Tool Call Flow

```
AI agent sends MCP request
    │
    ▼
GET/POST /api/mcp (Authorization: Bearer <api_key>)
    │
    ▼
Authenticate: look up agent by API key
    │
    ▼
MCP server routes to tool handler
    │
    ▼
Tool handler calls PocketBase (admin client)
    │
    ▼
Return JSON result to agent
    │
    ▼
Agent activity logged to agent_activity collection
```

## Realtime Architecture

Project E uses Server-Sent Events (SSE) to push realtime updates from PocketBase to the browser.

### Why SSE Instead of WebSockets

1. **Simpler infrastructure**: SSE works over standard HTTP, no special proxy configuration needed
2. **Unidirectional**: The server pushes events; the client sends commands through REST. This matches the data flow.
3. **Auto-reconnect**: The browser's `EventSource` API handles reconnection automatically
4. **PocketBase native**: PocketBase has built-in realtime subscriptions. SSE is a natural proxy.

### SSE Proxy Architecture

PocketBase's realtime uses WebSockets internally. The Next.js app acts as a proxy:

```
Browser ──SSE──▶ /api/realtime ──WebSocket──▶ PocketBase
```

The proxy:
1. Opens a PocketBase WebSocket connection for each subscribed collection
2. Translates PocketBase events into SSE `data:` frames
3. Sends a `:ping` comment every 30 seconds to keep the connection alive
4. Cleans up all subscriptions when the client disconnects

### Subscription Management

Clients specify which collections to subscribe to via query parameters:

```
GET /api/realtime?collections=tasks,habits,projects
```

Default subscriptions (if no parameter): `tasks`, `habits`, `projects`, `notes`, `reports`, `milestones`, `notifications`.

### Event Format

```
data: {"type":"connected","collections":["tasks","habits"]}

data: {"type":"create","collection":"tasks","record":{"id":"abc","title":"New task"}}

data: {"type":"update","collection":"tasks","record":{"id":"abc","status":"done"}}

data: {"type":"delete","collection":"tasks","record":{"id":"abc"}}

:ping
```

### Client-Side Handling

The Zustand stores subscribe to SSE events and update local state:

```typescript
const eventSource = new EventSource("/api/realtime?collections=tasks");

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "update" && data.collection === "tasks") {
    useTaskStore.getState().updateTask(data.record);
  }
};
```

## Worker Architecture

The background worker processes asynchronous jobs stored in the `queue_jobs` PocketBase collection.

### Job Lifecycle

```
API creates job → status: "pending"
    │
    ▼
Worker polls for pending jobs (every 5s base)
    │
    ▼
Worker marks job as "in_progress"
    │
    ├──▶ Success → status: "completed"
    │
    └──▶ Failure → retry_count < max_retries?
            │
            ├──▶ Yes → status: "pending", scheduled_at: now + backoff
            │
            └──▶ No → status: "failed", error: message
```

### Polling Strategy

The worker uses exponential backoff to reduce database load when idle:

| Condition | Poll Interval |
|-----------|--------------|
| Jobs found | Reset to 5 seconds |
| No jobs | Multiply by 1.5 (max 60 seconds) |
| Error | Keep current interval |

### Job Types

| Type | Handler | Description |
|------|---------|-------------|
| `webhook_delivery` | `handleWebhookDelivery` | POST payload to webhook URL with HMAC signature |
| `agent_mention` | `handleAgentMention` | Dispatch task to agent webhook |
| `report_generation` | `handleReportGeneration` | Collect data and populate report content |
| `recurring_task` | `handleRecurringTask` | Compute next due date from RRULE and spawn task |
| `cleanup` | `handleCleanup` | Purge old webhook deliveries and error logs |

### Retry Strategy

Failed jobs retry with exponential backoff:

```
Retry 1: 5 seconds
Retry 2: 10 seconds
Retry 3: 20 seconds
...
Max backoff: 5 minutes
Max retries: 3 (configurable per job)
```

### Cleanup

The worker schedules a daily cleanup job that:
- Deletes webhook deliveries older than 90 days
- Deletes error logs older than 30 days

## MCP Server Architecture

The MCP server runs inside the Next.js API at `/api/mcp`. It uses the `@modelcontextprotocol/sdk` package.

### Transport

The server uses **Streamable HTTP** transport:

1. `GET /api/mcp`: Establish a session, returns `mcp-session-id` header
2. `POST /api/mcp`: Send JSON-RPC requests with `mcp-session-id` header
3. `DELETE /api/mcp`: End the session

Sessions are stored in an in-memory `Map<string, Transport>`.

### Authentication

Every request validates the `Authorization: Bearer <api_key>` header against the `agents` collection. Only active agents can connect.

### Tool Organization

Tools are organized by entity in `apps/web/lib/mcp/tools/`:

```
lib/mcp/
├── server.ts          : Creates McpServer, registers all tools
└── tools/
    ├── tasks.ts       : 8 tools
    ├── habits.ts      : 7 tools
    ├── projects.ts    : 6 tools
    ├── notes.ts       : 6 tools
    ├── reports.ts     : 5 tools
    ├── milestones.ts  : 5 tools
    ├── domains.ts     : 5 tools
    ├── tags.ts        : 5 tools
    ├── agents.ts      : 5 tools
    ├── webhooks.ts    : 5 tools
    └── analytics.ts   : 4 tools
```

Each file exports a `register*Tools(server)` function that adds tools to the server.

### Tool Execution

Tools use the admin PocketBase client (`createAdminClient()`) to bypass row-level security. This is safe because:
1. The MCP endpoint requires a valid agent API key
2. Agent permission tiers control which tools are available
3. All tool calls are logged to `agent_activity`

## Security

### Authentication

**User authentication** uses PocketBase's built-in auth system:
- Email/password login
- JWT tokens stored in `httpOnly` cookies
- 7-day token expiry with refresh endpoint
- Tokens validated on every API request via `withAuth` middleware

**Agent authentication** uses API keys:
- Each agent has a unique API key (UUID)
- Keys validated against the `agents` collection
- Disabled agents cannot authenticate
- Used for both MCP server and agent webhook callbacks

### Authorization

**API routes** use the `withAuth` middleware. All routes require a valid user session. PocketBase row-level security provides additional protection at the database level.

**MCP tools** use agent permission tiers. The `read_only` tier can only call `get_*` and `list_*` tools. The server enforces this at the tool registration level.

### Data Protection

- **Passwords**: Hashed by PocketBase using bcrypt
- **API keys**: Stored as plain text (UUIDs). Treat them like passwords.
- **Webhook secrets**: Used for HMAC-SHA256 payload signing
- **Admin token**: Stored in environment variable, not in the database
- **Cookies**: `httpOnly`, `secure` (production), `sameSite: lax`

### Input Validation

All API endpoints validate request bodies with Zod schemas from `@project-e/shared`. Invalid input returns a `400 VALIDATION_ERROR` with details about which fields failed.

### CORS

Configure CORS in `next.config.ts` for cross-origin requests. By default, Next.js allows same-origin requests only.

### Rate Limiting

The application does not enforce rate limiting. Configure it at the reverse proxy or infrastructure layer. See [Deployment Guide](DEPLOYMENT.md#rate-limiting) for recommendations.

## Performance

### Database

PocketBase uses SQLite, which handles read-heavy workloads well.

**Optimizations:**
- PocketBase enables WAL mode by default for concurrent reads
- Indexes on frequently queried fields (status, domain, project_id)
- Pagination limits prevent large result sets

**Limits:**
- SQLite handles thousands of concurrent reads
- Write throughput is limited by single-writer model
- For most personal/team use cases, this is not a bottleneck

### API Responses

**Caching:**
- List endpoints set `Cache-Control: private, max-age=60, stale-while-revalidate=300`
- This allows the browser to use stale data while revalidating in the background

**Compression:**
- Next.js compresses responses automatically (gzip/brotli)
- The reverse proxy should also enable compression

### Realtime

**Connection management:**
- Each SSE connection holds a PocketBase WebSocket subscription
- The proxy cleans up subscriptions on client disconnect
- Keepalive pings prevent idle connection timeouts

**Scaling limits:**
- Each SSE connection uses a server-side WebSocket to PocketBase
- For hundreds of concurrent users, consider connection pooling or a dedicated realtime service

### Frontend

**Next.js optimizations:**
- App Router with React Server Components for initial page loads
- Client components only where interactivity is needed
- Automatic code splitting per route
- Image optimization via `next/image`

**Bundle size:**
- shadcn/ui components are tree-shaken (only imported components are included)
- Zustand stores are lightweight (no boilerplate)
- Tiptap editor loads lazily

## Accessibility

Project E follows WCAG 2.1 AA guidelines.

### Keyboard Navigation

- All interactive elements are reachable via keyboard
- Focus order follows visual layout
- Focus indicators are visible (Tailwind `focus-visible:ring-2`)
- Modal dialogs trap focus and return it on close

### ARIA Labels

- Icon-only buttons include `aria-label` attributes
- Form fields have associated `<label>` elements
- Dynamic content uses `aria-live` regions
- Dialogs use `role="dialog"` and `aria-modal="true"`

### Color and Contrast

- Text meets 4.5:1 contrast ratio against backgrounds
- Status indicators use both color and text/icons
- Domain colors are customizable but default to accessible palette

### Screen Readers

- Semantic HTML elements (`<nav>`, `<main>`, `<section>`, `<article>`)
- Headings follow proper hierarchy (h1 → h2 → h3)
- Tables use `<th>` with `scope` attributes
- Toast notifications announce via `aria-live="polite"`

### Motion

- Animations respect `prefers-reduced-motion`
- No auto-playing content
- Transitions are subtle and brief
