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
                            │ Drizzle ORM
┌──────────────────────────▼──────────────────────────────────┐
│           Data Layer (PostgreSQL + Drizzle ORM)               │
│  PostgreSQL · Drizzle migrations · NextAuth credentials      │
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
| State Management | Zustand 5 |
| Rich Text | Tiptap 3 |
| Forms | React Hook Form 7, Zod 4 validation |
| Calendar | react-big-calendar, date-fns |
| Charts | Recharts 3 |
| Graph Visualization | react-force-graph-2d |
| Drag & Drop | @dnd-kit |
| Backend | Next.js API routes (App Router) |
| Database | PostgreSQL 16 with Drizzle ORM |
| Authentication | NextAuth 4 with credentials authentication |
| Background Jobs | Node.js worker with polling and exponential backoff |
| MCP Server | @modelcontextprotocol/sdk 1.29 |
| Monorepo | Turborepo 2.5, npm workspaces |
| Testing | Jest (unit/component), Playwright 1.61 (E2E) |

## Prerequisites

- **Node.js** 22.13.0 or later
- **npm** 10.0.0 or later
- **PostgreSQL** 16 or later

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

3. **Create the database**

    ```bash
    createuser -P project_e
    createdb -O project_e project_e
    ```

4. **Set environment variables**

   Create a `.env.local` file in the root:

    ```bash
    DATABASE_URL=postgresql://project_e:your_postgres_password@localhost:5432/project_e
    POSTGRES_PASSWORD=your_postgres_password
    NEXTAUTH_SECRET=your_long_random_secret
    INITIAL_ADMIN_EMAIL=admin@example.com
    INITIAL_ADMIN_PASSWORD=your_initial_admin_password
    ```

    `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` create the first admin account when you sign in with those credentials.

5. **Apply the database schema**

    ```bash
    psql "postgresql://project_e:your_postgres_password@localhost:5432/project_e" -f drizzle/0000_postgres.sql
    ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

    This starts all packages via Turborepo:
    - Web app at `http://localhost:3000`
    - Worker (if configured)

7. **Sign in as the initial admin**

    Open `http://localhost:3000` and sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.

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
│       │   │   ├── realtime/   # SSE updates
│       │   │   ├── mcp/        # MCP server endpoint
│       │   │   └── health/     # Health check
│       │   └── layout.tsx      # Root layout
│       ├── components/         # React components (shadcn/ui)
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Utilities, services, and NextAuth config
│       │   ├── mcp/            # MCP server and tools
│       │   ├── services/       # Business logic services
│       │   ├── stores/         # Zustand stores
│       │   ├── events/         # Event bus
│       │   ├── auth-config.ts  # NextAuth configuration
│       │   └── errors.ts       # Error handling
│       └── types/              # TypeScript type definitions
├── packages/
│   ├── db/                     # Drizzle schema and PostgreSQL client
│   └── shared/                 # Shared package
│       └── src/
│           ├── schemas/        # Zod validation schemas
│           ├── types/          # TypeScript types
│           └── constants/      # Shared constants
├── drizzle/                    # Generated PostgreSQL migrations
├── worker/
│   └── index.ts                # Background job worker
├── e2e/                        # Playwright E2E tests
├── tests/                      # Unit and component tests
├── drizzle.config.ts           # Drizzle Kit configuration
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
| `npm run db:generate` | Generate Drizzle migrations |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `POSTGRES_PASSWORD` | Password for the `project_e` PostgreSQL user | (required) |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth sessions | (required) |
| `INITIAL_ADMIN_EMAIL` | Email for the account created on first sign-in | (required) |
| `INITIAL_ADMIN_PASSWORD` | Password for the account created on first sign-in | (required) |
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

### Environment Configuration

Provision PostgreSQL, apply `drizzle/0000_postgres.sql`, and set these in your deployment environment:

```bash
DATABASE_URL=postgresql://project_e:your_postgres_password@your-postgres-host:5432/project_e
POSTGRES_PASSWORD=your_postgres_password
NEXTAUTH_SECRET=your_long_random_secret
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=your_initial_admin_password
```

Start the web app and worker after the database is available:

```bash
npm run build
npm run --workspace @project-e/web start
npm run --workspace @project-e/worker start
```

### Health Checks

Use `GET /api/health` to check the web app.

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
