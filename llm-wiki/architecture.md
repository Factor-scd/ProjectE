# Architecture

## System Overview

Project E is a full-stack personal productivity OS with realtime collaboration, AI agent integration, and keyboard-driven UI.

## Three-Layer Architecture

```
Frontend (Next.js React)  →  Next.js API Routes (business logic)  →  PostgreSQL (data store)
         │                              │
         │                              ├── NOTIFY (on write)
         │                              │
         └── SSE (EventSource) ←────────┘
```

## Data Flow

1. User action → API route → Drizzle write → `pg.notify()` → SSE endpoint → Zustand store → UI update
2. External agent → MCP tool call → API route → Drizzle write → `pg.notify()` → SSE → UI update
3. Worker → webhook delivery / recurring spawn → API route → Drizzle write → `pg.notify()` → SSE → UI update

## Container Layout

- **project-e-web** — Next.js 15 (App Router), frontend + REST API + MCP + SSE
- **project-e-db** — PostgreSQL 16, all data + LISTEN/NOTIFY
- **project-e-worker** — Node.js worker, webhook delivery + recurring spawning + AI dispatch

## Monorepo Structure

```
ProjectE/
├── apps/
│   ├── web/           # Next.js 15 app
│   └── worker/        # Node.js worker process
├── packages/
│   ├── db/            # Drizzle schema + connection
│   └── shared/        # Shared types, schemas, constants
├── docker-compose.yml
├── AGENTS.md
└── llm-wiki/
```
