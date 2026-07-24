# Development Guide

Use this guide to run Project E locally, change the database schema, and prepare a pull request.

## Prerequisites

- Node.js 22.13.0 or later
- npm 10.0.0 or later
- Docker and Docker Compose, for PostgreSQL 16
- Git

## Set up your local environment

1. Clone the repository and install dependencies.

   ```bash
   git clone <repository-url>
   cd ProjectE
   npm install
   ```

2. Copy the environment template.

   ```bash
   cp .env.example .env
   ```

3. Set the database and authentication values in `.env`.

   ```bash
   DATABASE_URL=postgresql://project_e:your_postgres_password@localhost:5432/project_e
   POSTGRES_PASSWORD=your_postgres_password
   NEXTAUTH_SECRET=your_long_random_secret
   INITIAL_ADMIN_EMAIL=admin@example.com
   INITIAL_ADMIN_PASSWORD=your_initial_admin_password
   ```

   `DATABASE_URL` connects local processes to PostgreSQL. `POSTGRES_PASSWORD` must match the password in that URL. Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

4. Start PostgreSQL 16.

   ```bash
   docker compose up db -d
   ```

   Docker initializes the `project_e` database and applies `drizzle/0000_first_mauler.sql` when it creates an empty database volume.

5. Start the app.

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` and sign in with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.

   The credentials create the first admin account only when the `users` table has no accounts.

## Project structure

```
project-e/
├── apps/web/                 # Next.js application
│   ├── app/                  # App Router pages and API routes
│   ├── components/           # React components
│   ├── hooks/                # Custom React hooks
│   └── lib/                  # Services, database adapter, and NextAuth config
├── packages/
│   ├── db/                   # Drizzle schema and PostgreSQL client
│   └── shared/               # Shared schemas, types, and constants
├── drizzle/                  # Generated PostgreSQL migrations
├── worker/                   # Background job worker
├── e2e/                      # Playwright tests
├── tests/                    # Unit and component tests
├── drizzle.config.ts         # Drizzle Kit configuration
└── docker-compose.yml        # Web, PostgreSQL, and worker services
```

## Data access and authentication

The app uses Drizzle ORM with PostgreSQL. `packages/db/src/schema.ts` defines the schema, and `packages/db/src/index.ts` creates the database client from `DATABASE_URL`.

Application records live in the `records` table as JSONB data grouped by collection. The `users` table stores email addresses and bcrypt password hashes. API routes use the database adapter in `apps/web/lib/database.ts` for collection operations.

NextAuth uses the credentials provider. It creates JWT sessions after a user signs in with an email address and password. Keep `NEXTAUTH_SECRET` stable for an environment; changing it invalidates existing sessions.

## Add a feature

1. Define or update the data shape in `packages/db/src/schema.ts`.
2. Generate a Drizzle migration.

   ```bash
   npm run db:generate
   ```

3. Review and commit the generated SQL in `drizzle/`.
4. Apply the migration to your local PostgreSQL database before testing. The initial Docker setup applies `drizzle/0000_first_mauler.sql`; apply later migrations through your deployment migration process.
5. Update shared Zod schemas in `packages/shared/` when validation changes.
6. Update the relevant API route, service, state, and UI.
7. Add tests for the new behavior.

## Database schema changes

- Do not edit a migration after another environment has applied it.
- Keep the Drizzle schema and generated SQL in the same pull request.
- Test a migration against a database with representative data.
- Add indexes for fields used in common filters or sorts.
- Back up production data before applying a migration.

`drizzle.config.ts` reads `DATABASE_URL` and writes generated migrations to `drizzle/`.

## Testing

Run the checks that match your change:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Unit tests cover validation, utilities, services, and store actions. Component tests cover rendering and user interactions. Playwright tests cover browser flows such as signing in, creating a task, and completing it.

## Code conventions

- Use TypeScript strict mode.
- Prefer `unknown` over `any` for external input.
- Keep React components focused and extract shared logic into hooks.
- Use Tailwind utility classes, `cn()` for class merging, and `cva` for variants.
- Validate API input with shared Zod schemas.
- Catch errors at API boundaries and log request context.

## Git workflow

Use conventional commits and keep each commit focused. Before pushing, run the relevant checks and review `git diff --stat`.

Use these branch prefixes:

```
feature/description
fix/description
refactor/description
chore/description
```

Pull requests should explain the change, its reason, and the tests you ran. Include screenshots for UI changes.
