# Architecture Documentation

Project E is a Next.js monorepo that stores application data in PostgreSQL 16 through Drizzle ORM. NextAuth credentials authentication manages user sessions. This document describes the implemented system.

## System overview

```
Browser
  │
  ├── REST requests and Server-Sent Events
  ▼
Next.js application (apps/web)
  ├── App Router pages and API routes
  ├── NextAuth credentials provider and JWT sessions
  ├── Services, validation, and collection adapter
  ├── MCP server
  └── Drizzle ORM
        │
        ▼
PostgreSQL 16
  ├── users
  ├── records (JSONB application data)
  └── project_e_events notifications
        │
        ▼
Background worker
  └── Polls queue_jobs records and processes asynchronous work
```

## Application layers

### Presentation

`apps/web/app/` contains App Router pages and API routes. `apps/web/components/` contains UI components. Zustand stores and hooks manage client-side state and consume API and SSE updates.

### Business logic

`apps/web/lib/services/` contains entity behavior such as task, habit, note, report, project, webhook, and agent-mention services. `packages/shared/` provides Zod schemas and TypeScript types for validation across the app and worker.

### Persistence

`packages/db/src/schema.ts` defines Drizzle's PostgreSQL schema. `packages/db/src/index.ts` creates a Drizzle client from `DATABASE_URL`.

The `users` table stores user identity, email addresses, and bcrypt password hashes. The `records` table stores collection data in JSONB with a collection name and timestamps. `apps/web/lib/database.ts` exposes collection operations over those records and emits PostgreSQL notifications after creates, updates, and deletes.

## Authentication and authorization

NextAuth uses the credentials provider and JWT sessions. A user signs in with an email address and password. The authorization flow normalizes the email address, reads the user from PostgreSQL, and compares the password against its bcrypt hash.

On an empty `users` table, a sign-in matching `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` creates the first account. Set `NEXTAUTH_SECRET` for each environment and keep it stable to preserve active sessions.

API routes require an authenticated user through the application's authentication middleware. MCP requests use agent API keys and permission tiers. The `read_only` tier limits agents to read operations.

## Request and data flow

### Create a task

```
Browser → POST /api/tasks → authenticated API route
        → Zod validation → service and collection adapter
        → Drizzle write to PostgreSQL
        → pg_notify('project_e_events')
        → SSE clients receive the update
```

### Realtime updates

The `/api/realtime` endpoint authenticates the request, opens a PostgreSQL listener for `project_e_events`, and streams matching collection events through Server-Sent Events. Clients can specify a comma-separated `collections` query parameter. The endpoint sends a keepalive comment every 30 seconds and closes its PostgreSQL listener when the client disconnects.

The reverse proxy must not buffer SSE responses.

## Drizzle migrations and Docker

Drizzle Kit reads `drizzle.config.ts`, which points to `packages/db/src/schema.ts` and writes generated SQL to `drizzle/`. `DATABASE_URL` supplies the PostgreSQL connection string.

Docker Compose runs PostgreSQL 16 and mounts `drizzle/0000_first_mauler.sql` as an initialization script. PostgreSQL runs initialization scripts only for a new data volume. Apply later reviewed migrations during deployment; restarting an existing database container does not run them.

## Background worker

The worker polls `queue_jobs` records for due work. It marks a job `in_progress`, runs the handler, then records `completed` or schedules a retry after an error. Its polling interval starts at five seconds, grows to 60 seconds when no work is available, and resets when it finds jobs.

Supported job types include webhook delivery, agent mentions, report generation, recurring tasks, and cleanup. Failed jobs retry with exponential backoff up to their configured retry limit.

## MCP server

The MCP server runs at `/api/mcp` over Streamable HTTP. It establishes sessions with `GET`, accepts JSON-RPC requests with `POST`, and ends sessions with `DELETE`. The app keeps active transports in memory.

Tools live in `apps/web/lib/mcp/tools/` and register by entity. Tool handlers use the database-backed collection adapter. Agent API keys identify callers, permission tiers restrict access, and the app records agent activity.

## Security

- PostgreSQL credentials come from `DATABASE_URL` and `POSTGRES_PASSWORD`.
- NextAuth signs JWT sessions with `NEXTAUTH_SECRET`.
- The app stores password hashes with bcrypt, never plaintext passwords.
- Cookies use `httpOnly`, `sameSite: lax`, and `secure` settings appropriate to the deployment.
- Zod schemas validate API request bodies.
- Reverse proxies should enforce TLS, host restrictions, and rate limits.

## Performance and operations

PostgreSQL stores indexed collection and creation-time metadata while retaining flexible collection fields in JSONB. API routes paginate list responses. The Drizzle client uses a connection pool with a maximum of 10 connections.

Each realtime client holds a PostgreSQL notification listener. Monitor long-lived SSE connections and proxy timeouts as concurrency grows. The worker uses database-backed job records, so multiple workers can process queued work when the job-claiming behavior supports the workload.

## Accessibility

Project E targets WCAG 2.1 AA. Interactive elements support keyboard navigation, icon-only controls include accessible names, form fields use labels, dialogs manage focus, and dynamic content uses live regions. The UI respects `prefers-reduced-motion` and pairs status colors with text or icons.
