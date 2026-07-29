# Conventions

## Naming

- Tables: snake_case, plural (e.g., `activity_feed`, `task_tags`)
- Columns: snake_case (e.g., `domain_id`, `created_at`)
- TypeScript: camelCase (e.g., `domainId`, `createdAt`)
- API routes: kebab-case (e.g., `/api/domains/[domainId]/tasks`)
- Files: kebab-case (e.g., `auth-config.ts`, `command-palette.tsx`)

## File Structure

- Schema: `packages/db/src/schema.ts` (single file for all tables)
- API routes: `apps/web/app/api/[entity]/route.ts`
- Components: `apps/web/components/[entity]/[component].tsx`
- Stores: `apps/web/lib/stores/use-[store-name]-store.ts`
- Lib: `apps/web/lib/[module].ts`

## Commit Format

```
type: short description

- Bullet points for details
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

## Build

- Run `npm run build --workspace=apps/web` before committing
- Do NOT commit build artifacts (`.next/`, `dist/`, `.turbo/`)
