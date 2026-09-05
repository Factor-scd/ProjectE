# Project E

Project E is a personal task and habit tracker designed for the AI-agent era. It combines traditional productivity tools with a built-in MCP (Model Context Protocol) server, allowing AI agents to read and write your data securely based on defined permission tiers.

## Features


- **Tasks:** Kanban boards, priorities, due dates, subtasks, time tracking, recurring tasks, dependencies, and attachments
- **Habits:** Daily/weekly/custom frequencies, streak tracking, mood logging, skip days, and completion scoring
- **Projects:** Organize work by domain, track progress through milestones, set deadlines, and manage team members
- **Notes:** Rich text editor with wikilinks, note graph visualization, and bookmarks
- **Reports:** Weekly, monthly, project, and habit reports with templates
- **Milestones:** Plan project phases, set dependencies, and track completion
- **Domains & Tags:** Organize everything across life domains (work, personal, health) with flexible tagging
- **AI Agents:** Register agents with API keys, assign permission tiers, and dispatch work via @mentions
- **Webhooks:** Subscribe to events, deliver payloads with HMAC signatures, and track delivery history
- **Analytics:** Task completion rates, habit consistency, time summaries, and streak tracking
- **Realtime:** SSE feed backed by PostgreSQL LISTEN/NOTIFY keeps the UI in sync across devices
- **Background Worker:** Bun process for webhook deliveries, agent mentions, recurring tasks, and data cleanup
- **MCP Server:** 18 tools for AI agents to read and write data through the Model Context Protocol

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      Frontend (Vite SPA)                       │
│   React 19 · TanStack Router/Query · shadcn/ui · Tailwind     │
└──────────────────────────┬────────────────────────────────────┘
                           │ REST API + SSE
                           │ (Vite dev proxy → :3001)
┌──────────────────────────▼────────────────────────────────────┐
│                API (Hono on Bun, apps/api)                     │
│   Auth (JWT) · Routes · Realtime SSE · MCP server · Webhooks  │
└──────────────────────────┬────────────────────────────────────┘
                           │ Drizzle ORM (postgres driver)
┌──────────────────────────▼────────────────────────────────────┐
│                  PostgreSQL 16 + Drizzle ORM                   │
│   Schema in packages/db/src/schema.ts · migrations in drizzle/ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                 Background Worker (Bun, apps/worker)            │
│   Webhook delivery · Agent mentions · Recurring tasks ·        │
│   Data cleanup                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite 5, React 19, TypeScript 5.9 |
| Routing / Data | TanStack Router, TanStack Query, TanStack Table |
| UI Components | shadcn/ui, Radix UI, Lucide icons |
| Styling | Tailwind CSS 3.4, tailwind-merge, class-variance-authority |
| State Management | Zustand 5 |
| Rich Text | Tiptap 3 |
| Forms | React Hook Form, Zod 4 validation |
| Calendar | react-big-calendar, date-fns |
| Charts | Recharts 3 |
| Graph Visualization | react-force-graph-2d |
| Drag & Drop | @dnd-kit |
| Backend | Hono 4 on Bun 1.3 (`apps/api`) |
| Database | PostgreSQL 16 with Drizzle ORM and the `postgres` driver |
| Authentication | JWT (jose) in an httpOnly session cookie; API keys for agents |
| Background Jobs | Bun worker (`apps/worker`) |
| MCP Server | JSON-RPC over HTTP at `/api/mcp`, served by the API |
| Monorepo | Turborepo 2.5, Bun workspaces |
| Testing | Playwright (E2E in `e2e/`) |

## Prerequisites

- **Bun** 1.3.14 or later (the repo pins `bun@1.3.14`)
- **PostgreSQL** 16 (local install, or the Docker container from the compose file)
- **Docker + Docker Compose** for the production stack (see [DEPLOY.md](DEPLOY.md))

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://git.buzzbee.dev/Vibing/ProjectE.git
   cd ProjectE
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start PostgreSQL**

   ```bash
   docker compose up -d db
   ```

   Or point `DATABASE_URL` at an existing PostgreSQL 16 instance.

4. **Set environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `DATABASE_URL`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD`.

5. **Apply the database schema**

   ```bash
   bun run db:migrate
   ```

   Pushes the schema (`drizzle-kit push --force`) and applies the search-vector triggers. Idempotent, safe to re-run.

6. **Start the development servers**

   ```bash
   bun run dev
   ```

   - API (Hono) on `http://localhost:3001`
   - Web (Vite) on `http://localhost:3000`, proxying `/api` and `/mcp` to :3001

7. **Sign in as the initial admin**

   Open `http://localhost:3000` and sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. The first login creates the admin account.

## Project Structure

```
project-e/
├── apps/
│   ├── api/               # Hono + Bun API server (routes, middleware, auth)
│   ├── web/               # Vite + React 19 SPA (TanStack Router, shadcn/ui)
│   ├── worker/            # Bun background worker (src/index.ts)
│   └── web-legacy/        # Old Next.js app, kept for reference only
├── packages/
│   ├── db/                # Drizzle schema, client, and ORM access
│   └── shared/            # Shared types, schemas, and constants
├── drizzle/               # Drizzle migrations (0000–0005)
├── script/                # deploy.sh, apply-triggers.ts
├── e2e/                   # Playwright E2E tests
├── .gitea/workflows/      # Gitea Actions CI/CD (ci.yml)
├── docker-compose.yml     # Production stack (db, api, spa, worker)
├── Caddyfile              # SPA serving + /api reverse proxy
├── Dockerfile.api         # API image
├── Dockerfile.spa         # SPA build + Caddy image
├── Dockerfile.worker      # Worker image
├── bunfig.toml
├── drizzle.config.ts
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Run the API (watch) and the Vite dev server concurrently |
| `bun run dev:api` | API server with watch on :3001 |
| `bun run dev:web` | Vite dev server on :3000 |
| `bun run build` | Production build of the web SPA (`vite build`) |
| `bun run typecheck` | `tsc --noEmit` across api, worker, and web |
| `bun run db:push` | Push schema changes to the database (`drizzle-kit push`) |
| `bun run db:sync` | Push schema with `--force` (idempotent) |
| `bun run db:generate` | Generate a new Drizzle migration from schema changes |
| `bun run db:triggers` | Apply the search-vector triggers (idempotent) |
| `bun run db:migrate` | `db:sync` + `db:triggers`; what deploys run |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run deploy` | Run `script/deploy.sh` (see DEPLOY.md) |

## Environment Variables

Variables live in a root `.env` file (not `.env.local`). Copy from `.env.example`.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `POSTGRES_PASSWORD` | Password for the `project_e` user (used by docker-compose) | (required) |
| `AUTH_SECRET` | Secret that signs JWT sessions (`NEXTAUTH_SECRET` is accepted as a fallback) | (required) |
| `INITIAL_ADMIN_EMAIL` | Email for the account created on first sign-in | (required) |
| `INITIAL_ADMIN_PASSWORD` | Password for the account created on first sign-in | (required) |
| `NODE_ENV` | `development` or `production` | `development` |
| `PUBLIC_URL` | Absolute URL used for emails and webhooks | `http://localhost:3000` |
| `COOKIE_SECURE` | Set `true` behind HTTPS | `false` |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames | `localhost` |

## Testing

Playwright E2E tests live in `e2e/` (config at the repo root). Start the dev stack (`bun run dev`) in one terminal, then run:

```bash
# Full suite
bunx playwright test

# Interactive UI mode
bunx playwright test --ui

# Plain list reporter
bunx playwright test --reporter=list
```

Tests run against Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari, and cover authentication, tasks, habits, projects, notes, reports, analytics, calendar, dashboard, search, settings, webhooks, realtime, MCP, and import/export.

## Deployment

Production runs as a docker-compose stack (db, api, spa, worker) on the host. Gitea Actions drives deploys: a `quality` gate runs on every push and PR, a `deploy` job on pushes to `main` runs `script/deploy.sh`, and a `smoke` job verifies health afterwards. Manual steps, rollback, and troubleshooting are in [DEPLOY.md](DEPLOY.md).

## Documentation

- [API Documentation](docs/API.md): REST API endpoints, authentication, error handling
- [MCP Server Documentation](docs/MCP.md): Model Context Protocol tools and usage
- [Deployment Guide](docs/DEPLOYMENT.md): Production deployment, SSL, backups, monitoring
- [Development Guide](docs/DEVELOPMENT.md): Contributing, code structure, testing strategy
- [Architecture Documentation](docs/ARCHITECTURE.md): System design, data flow, security

## Contributing

1. Fork the repository on Gitea and create a feature branch
2. Make your changes
3. Run `bun run typecheck` and `cd apps/web && bun run build` before committing
4. Push the branch and open a pull request. CI runs the same quality gate on every push and PR.

## License

This project is private and proprietary.
