# Project E

A personal project, habit, and task tracker built for the AI-agent era. Track tasks, build habits, manage projects, write notes, generate reports, and let AI agents work alongside you through a native MCP (Model Context Protocol) server.

## Features

- **Tasks:** Kanban boards, priorities, due dates, subtasks, time tracking, recurring tasks, dependencies, and attachments
- **Habits:** Daily/weekly/custom frequencies, streak tracking, mood logging, skip days, and completion scoring
- **Projects:** Organize work by domain, track progress through milestones, set deadlines, and manage team members
- **Notes:** Rich text editor with wikilinks, note graph visualization, bookmarks, and AI-generated content support
- **Reports:** Weekly, monthly, project, and habit reports with templates and AI-assisted generation
- **Milestones:** Plan project phases, set dependencies, and track completion
- **Domains & Tags:** Organize everything across life domains (work, personal, health) with flexible tagging
- **AI Agents:** Register agents with API keys, assign permission tiers, and dispatch work via @mentions
- **Webhooks:** Subscribe to events, deliver payloads with HMAC signatures, and track delivery history
- **Analytics:** Task completion rates, habit consistency, time summaries, and streak tracking
- **Realtime:** Server-sent events proxy keeps the UI in sync across devices
- **Background Worker:** Processes webhook deliveries, agent mentions, report generation, recurring tasks, and data cleanup
- **MCP Server:** 61 tools for AI agents to read and write data through the Model Context Protocol

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  React 19 · App Router · shadcn/ui · Tailwind · Zustand     │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API + SSE
┌──────────────────────────▼──────────────────────────────────┐
│                   API Layer (Next.js Routes)                  │
│  Auth · Validation (Zod) · Realtime SSE Proxy · MCP Server  │
└──────────────────────────┬──────────────────────────────────┘
                           │ PocketBase SDK
┌──────────────────────────▼──────────────────────────────────┐
│                   Data Layer (PocketBase)                     │
│  SQLite · Auth · Realtime · File Storage · Admin UI          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Background Worker                          │
│  Webhook Delivery · Agent Mentions · Report Generation       │
│  Recurring Tasks · Data Cleanup                              │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript 5.9 |
| UI Components | shadcn/ui, Radix UI, Lucide icons |
| Styling | Tailwind CSS 3.4, tailwind-merge, class-variance-authority |
| State Management | Zustand 5 (UI), PocketBase realtime (data) |
| Rich Text | Tiptap 3 |
| Forms | React Hook Form 7, Zod 4 validation |
| Calendar | react-big-calendar, date-fns |
| Charts | Recharts 3 |
| Graph Visualization | react-force-graph-2d |
| Drag & Drop | @dnd-kit |
| Backend | Next.js API routes (App Router) |
| Database | PocketBase 0.25 (SQLite) |
| Background Jobs | Node.js worker with polling and exponential backoff |
| MCP Server | @modelcontextprotocol/sdk 1.29 |
| Monorepo | Turborepo 2.5, npm workspaces |
| Testing | Jest (unit/component), Playwright 1.61 (E2E) |
| Deployment | Docker Compose (3 containers) |

## Prerequisites

- **Node.js** 22.13.0 or later
- **npm** 10.0.0 or later
- **Docker** and Docker Compose (for production deployment)
- **PocketBase** 0.25.5 (included in Docker setup)

## Quick Start

### Development Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ProjectE
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start PocketBase** (in a separate terminal)

   ```bash
   # Download PocketBase if you haven't already
   # https://pocketbase.io/docs/

   # Start PocketBase with migrations
   pocketbase serve --dir=./pb_data --publicDir=./pb_public --migrationDir=./pocketbase/pb_migrations
   ```

   Or use Docker:

   ```bash
   docker compose up db -d
   ```

4. **Set environment variables**

   Create a `.env.local` file in the root:

   ```bash
   POCKETBASE_URL=http://localhost:8090
   POCKETBASE_ADMIN_TOKEN=your_admin_token_here
   ```

   Get the admin token from PocketBase after creating your first admin account.

5. **Start the development server**

   ```bash
   npm run dev
   ```

   This starts all packages via Turborepo:
   - Web app at `http://localhost:3000`
   - PocketBase at `http://localhost:8090`
   - Worker (if configured)

6. **Create your first user**

   Open `http://localhost:3000` and sign up, or use the PocketBase admin UI at `http://localhost:8090/_/` to create users.

### Production Deployment (Docker)

```bash
# Build and start all containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop all containers
docker compose down
```

The deployment starts three containers:
- **web:** Next.js app on port 3000
- **db:** PocketBase on port 8090
- **worker:** Background job processor

## Project Structure

```
project-e/
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages and API routes
│       │   ├── (auth)/         # Auth pages (login, signup)
│       │   ├── (dashboard)/    # Dashboard pages
│       │   ├── api/            # REST API endpoints
│       │   │   ├── auth/       # Login, logout, refresh, me
│       │   │   ├── tasks/      # Task CRUD + bulk operations
│       │   │   ├── habits/     # Habit CRUD
│       │   │   ├── projects/   # Project CRUD
│       │   │   ├── notes/      # Note CRUD
│       │   │   ├── reports/    # Report CRUD
│       │   │   ├── milestones/ # Milestone CRUD
│       │   │   ├── domains/    # Domain CRUD
│       │   │   ├── tags/       # Tag CRUD
│       │   │   ├── agents/     # Agent CRUD
│       │   │   ├── webhooks/   # Webhook CRUD
│       │   │   ├── analytics/  # Analytics data
│       │   │   ├── realtime/   # SSE proxy for PocketBase
│       │   │   ├── mcp/        # MCP server endpoint
│       │   │   └── health/     # Health check
│       │   └── layout.tsx      # Root layout
│       ├── components/         # React components (shadcn/ui)
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities and services
│       │   ├── mcp/            # MCP server and tools
│       │   ├── services/       # Business logic services
│       │   ├── stores/         # Zustand stores
│       │   ├── events/         # Event bus
│       │   ├── auth.ts         # Auth middleware
│       │   ├── pocketbase.ts   # PocketBase client
│       │   └── errors.ts       # Error handling
│       └── types/              # TypeScript type definitions
├── packages/
│   └── shared/                 # Shared package
│       └── src/
│           ├── schemas/        # Zod validation schemas
│           ├── types/          # TypeScript types
│           └── constants/      # Shared constants
├── pocketbase/
│   ├── pb_migrations/          # Database migrations
│   └── schema.ts               # TypeScript types for collections
├── worker/
│   └── index.ts                # Background job worker
├── e2e/                        # Playwright E2E tests
├── tests/                      # Unit and component tests
├── docker-compose.yml          # Docker Compose configuration
├── Dockerfile.web              # Web container build
├── Dockerfile.pocketbase       # PocketBase container build
├── Dockerfile.worker           # Worker container build
├── turbo.json                  # Turborepo configuration
└── package.json                # Root package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all packages in development mode |
| `npm run build` | Build all packages for production |
| `npm run lint` | Run linting across all packages |
| `npm run test` | Run unit and component tests (Jest) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright tests with UI mode |
| `npm run test:e2e:report` | Show Playwright test report |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:generate` | Generate database types |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POCKETBASE_URL` | PocketBase server URL | `http://localhost:8090` |
| `POCKETBASE_ADMIN_TOKEN` | Admin authentication token | (required for worker) |
| `NODE_ENV` | Environment (`development`, `production`) | `development` |

Create a `.env.local` file in the root directory for local development.

## Testing

### Unit and Component Tests

```bash
npm run test
```

Runs Jest tests across all packages. Tests are located in `tests/` and alongside components.

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

Playwright tests are in `e2e/` and cover:
- Authentication flows
- Task management
- Habit tracking
- Project organization
- Note editing
- Report generation
- Analytics dashboards
- Navigation and settings

Tests run against five browser configurations: Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari.

## Deployment

### Docker Compose (Recommended)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after code changes
docker compose up -d --build
```

### Environment Configuration

Set these in your deployment environment:

```bash
POCKETBASE_URL=http://db:8090
POCKETBASE_ADMIN_TOKEN=your_secure_admin_token
```

### Volumes

- `project-e-pb-data`: PocketBase database files
- `project-e-web-uploads`: Uploaded files

### Health Checks

All containers include health checks:
- Web: `GET /api/health`
- PocketBase: `GET /api/health`

## Documentation

- [API Documentation](docs/API.md): REST API endpoints, authentication, error handling
- [MCP Server Documentation](docs/MCP.md): Model Context Protocol tools and usage
- [Deployment Guide](docs/DEPLOYMENT.md): Production deployment, SSL, backups, monitoring
- [Development Guide](docs/DEVELOPMENT.md): Contributing, code structure, testing strategy
- [Architecture Documentation](docs/ARCHITECTURE.md): System design, data flow, security

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test && npm run test:e2e`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow existing code style (TypeScript, functional components)
- Update documentation for API changes
- Keep commits atomic and well-described
- Use conventional commit messages

### Code Review Process

- All PRs require at least one review
- CI must pass (lint, typecheck, tests)
- Keep PRs focused on a single concern
- Write clear PR descriptions explaining the "why"

## License

This project is private and proprietary.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation in `docs/`
- Review existing issues for similar problems
