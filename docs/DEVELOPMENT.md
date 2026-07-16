# Development Guide

This guide covers the development workflow for Project E. Read this before contributing code.

## Table of Contents

- [Environment Setup](#environment-setup)
- [Project Structure](#project-structure)
- [Code Organization](#code-organization)
- [Adding a New Feature](#adding-a-new-feature)
- [Database Schema Changes](#database-schema-changes)
- [Testing Strategy](#testing-strategy)
- [Code Style and Conventions](#code-style-and-conventions)
- [Git Workflow](#git-workflow)
- [PR Review Process](#pr-review-process)
- [Common Tasks](#common-tasks)

## Environment Setup

### Prerequisites

- **Node.js** 22.13.0 or later (use `nvm` to manage versions)
- **npm** 10.0.0 or later
- **Git**
- **A code editor** (VS Code recommended)
- **PocketBase** binary (download from [pocketbase.io](https://pocketbase.io))

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ProjectE
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start PocketBase**

   In a separate terminal:

   ```bash
   pocketbase serve \
     --dir=./pb_data \
     --publicDir=./pb_public \
     --migrationDir=./pocketbase/pb_migrations
   ```

   Or use Docker:

   ```bash
   docker compose up db -d
   ```

4. **Set environment variables**

   Create `apps/web/.env.local`:

   ```bash
   POCKETBASE_URL=http://localhost:8090
   POCKETBASE_ADMIN_TOKEN=your_admin_token
   ```

   Get the admin token from PocketBase after creating your first admin account.

5. **Start the development server**

   ```bash
   npm run dev
   ```

   This starts the Next.js app at `http://localhost:3000` with Turbopack.

6. **Verify everything works**

   - Open `http://localhost:3000` in your browser
   - Open `http://localhost:8090/_/` for the PocketBase admin UI
   - Run `npm run typecheck` to verify TypeScript compiles

### VS Code Setup

Recommended extensions:
- ESLint
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features (built-in)
- Prettier - Code formatter

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

## Project Structure

```
project-e/
├── apps/
│   └── web/                    # Next.js application (monorepo app)
│       ├── app/                # App Router (pages + API routes)
│       │   ├── (auth)/         # Auth route group (login, signup)
│       │   ├── (dashboard)/    # Dashboard route group
│       │   └── api/            # REST API endpoints
│       ├── components/         # React components
│       │   ├── ui/             # shadcn/ui primitives
│       │   └── ...             # Feature components
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Core utilities
│       │   ├── mcp/            # MCP server and tools
│       │   ├── services/       # Business logic
│       │   ├── stores/         # Zustand stores
│       │   ├── events/         # Event bus
│       │   ├── auth.ts         # Auth middleware
│       │   ├── pocketbase.ts   # PocketBase client
│       │   └── errors.ts       # Error handling
│       └── types/              # TypeScript type definitions
├── packages/
│   └── shared/                 # Shared package (@project-e/shared)
│       └── src/
│           ├── schemas/        # Zod validation schemas
│           ├── types/          # Shared TypeScript types
│           └── constants/      # Shared constants
├── pocketbase/
│   ├── pb_migrations/          # Database migrations
│   └── schema.ts               # TypeScript types for collections
├── worker/                     # Background job worker
│   └── index.ts                # Worker entry point
├── e2e/                        # Playwright E2E tests
├── tests/                      # Unit and component tests
└── docker-compose.yml          # Docker Compose configuration
```

## Code Organization

### Layers

The application follows a three-layer architecture:

1. **Presentation**: React components in `apps/web/components/` and pages in `apps/web/app/`
2. **Business Logic**: Services in `apps/web/lib/services/` and shared schemas in `packages/shared/`
3. **Data Access**: PocketBase client in `apps/web/lib/pocketbase.ts` and API routes in `apps/web/app/api/`

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `TaskCard.tsx` |
| Hooks | camelCase with `use` prefix | `use-task-filter.ts` |
| Utilities | camelCase | `format-date.ts` |
| Types | PascalCase | `Task.ts` |
| Schemas | camelCase with `Schema` suffix | `taskSchema` |
| API routes | kebab-case directory | `api/habit-logs/route.ts` |
| Stores | camelCase with `use` prefix | `use-dashboard-store.ts` |

### Import Paths

Use the `@/` alias for imports within `apps/web`:

```typescript
import { createPocketBaseClient } from '@/lib/pocketbase';
import { TaskCard } from '@/components/task-card';
```

Use the package name for shared imports:

```typescript
import { createTaskSchema } from '@project-e/shared';
```

## Adding a New Feature

Follow these steps to add a feature end-to-end. This example adds a "bookmarks" feature to notes.

### Step 1: Define the Schema

Add the field to the PocketBase collection schema. Create a migration file:

```bash
# pocketbase/pb_migrations/20240115120000_add_bookmarks.js
export default {
  up(db) {
    const collection = db.findCollectionByNameOrId("notes");
    collection.fields.add(new Field({
      name: "bookmarked",
      type: "bool",
      options: { default: false }
    }));
    return db.saveCollection(collection);
  },
  down(db) {
    const collection = db.findCollectionByNameOrId("notes");
    collection.fields.removeByName("bookmarked");
    return db.saveCollection(collection);
  }
}
```

### Step 2: Update TypeScript Types

Update the type definition in `pocketbase/schema.ts`:

```typescript
export interface Note extends BaseRecord {
  // ... existing fields
  bookmarked: boolean;
}
```

### Step 3: Add Validation Schema

Update the Zod schema in `packages/shared/src/schemas/note.ts`:

```typescript
export const noteSchema = z.object({
  // ... existing fields
  bookmarked: z.boolean().default(false),
});
```

### Step 4: Update the API

If the API route needs changes, update it in `apps/web/app/api/notes/route.ts`. Most CRUD operations work automatically through PocketBase, so you may not need API changes.

### Step 5: Build the UI

Create or update components:

```tsx
// apps/web/components/note-bookmark-button.tsx
"use client";

import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoteBookmarkButtonProps {
  noteId: string;
  bookmarked: boolean;
  onToggle: (noteId: string) => void;
}

export function NoteBookmarkButton({ noteId, bookmarked, onToggle }: NoteBookmarkButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => onToggle(noteId)}
      aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <Bookmark className={bookmarked ? "fill-current" : ""} />
    </Button>
  );
}
```

### Step 6: Add State Management

If needed, update the Zustand store:

```typescript
// apps/web/lib/stores/use-notes-store.ts
interface NotesState {
  // ... existing state
  toggleBookmark: (noteId: string) => Promise<void>;
}
```

### Step 7: Write Tests

Add tests for the new functionality:

```typescript
// tests/note-bookmark.test.ts
describe("NoteBookmarkButton", () => {
  it("toggles bookmark state on click", () => {
    // ...
  });
});
```

### Step 8: Update MCP Tools (if applicable)

If the feature should be accessible to AI agents, add or update MCP tools in `apps/web/lib/mcp/tools/`.

### Step 9: Verify

1. Run `npm run typecheck`: TypeScript compiles without errors
2. Run `npm run lint`: No lint errors
3. Run `npm run test`: All tests pass
4. Run `npm run test:e2e`: E2E tests pass (if applicable)
5. Test manually in the browser

## Database Schema Changes

### Creating Migrations

PocketBase migrations are JavaScript files in `pocketbase/pb_migrations/`.

**Naming convention:** `YYYYMMDDHHMMSS_description.js`

**Example (add a new collection):**

```javascript
export default {
  async up(db) {
    const collection = new Collection({
      name: "bookmarks",
      type: "base",
      fields: [
        { name: "title", type: "text", required: true },
        { name: "url", type: "url", required: true },
        { name: "note_id", type: "relation", options: { collectionId: "notes" } },
      ],
    });
    return db.saveCollection(collection);
  },

  async down(db) {
    return db.deleteCollection("bookmarks");
  },
};
```

### Running Migrations

Migrations run automatically when PocketBase starts. To run them manually:

```bash
pocketbase migrate --dir=./pocketbase/pb_migrations --dir=./pb_data
```

### Updating TypeScript Types

After changing the schema, update the TypeScript types in `pocketbase/schema.ts` to match. This keeps the type system in sync with the database.

### Rules for Schema Changes

1. **Always provide both `up` and `down`**: Migrations must be reversible
2. **Never modify existing migrations**: Create new ones instead
3. **Test migrations locally** before committing
4. **Update TypeScript types** in the same PR as the migration
5. **Update Zod schemas** in `packages/shared/` if the change affects validation

## Testing Strategy

### Unit Tests

Unit tests cover pure functions and business logic. They run with Jest.

```bash
npm run test
```

**Location:** `tests/` directory or alongside source files.

**What to test:**
- Zod schema validation
- Utility functions (date formatting, string manipulation)
- Service layer logic
- Store actions

**Example:**

```typescript
// tests/format-duration.test.ts
import { formatDuration } from "@/lib/utils";

describe("formatDuration", () => {
  it("formats minutes to hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("handles zero minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});
```

### Component Tests

Component tests verify React components render correctly and handle user interactions.

**Location:** `tests/` directory or alongside component files.

**What to test:**
- Components render with required props
- User interactions trigger correct callbacks
- Conditional rendering works as expected

### E2E Tests

E2E tests verify complete user flows using Playwright. They run against a real browser.

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive debugging)
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

**Location:** `e2e/` directory.

**Browser configurations:**
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

**What to test:**
- Complete user flows (login → create task → complete task)
- Navigation between pages
- Form submissions
- Realtime updates
- Error states

**Example:**

```typescript
// e2e/tasks.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Tasks", () => {
  test("create and complete a task", async ({ page }) => {
    await page.goto("/dashboard/tasks");
    await page.click('[data-testid="create-task-button"]');
    await page.fill('[data-testid="task-title"]', "New task");
    await page.click('[data-testid="create-button"]');

    await expect(page.locator('[data-testid="task-item"]')).toContainText("New task");

    await page.click('[data-testid="task-checkbox"]');
    await expect(page.locator('[data-testid="task-status"]')).toHaveText("done");
  });
});
```

### Test Naming

- Unit tests: `describe("functionName", () => { ... })`
- Component tests: `describe("ComponentName", () => { ... })`
- E2E tests: `test.describe("Feature", () => { ... })`

### Running Tests in CI

CI runs all tests automatically on every PR:

```bash
npm run typecheck    # TypeScript check
npm run lint         # Linting
npm run test         # Unit + component tests
npm run test:e2e     # E2E tests
```

## Code Style and Conventions

### TypeScript

- Use strict mode (enabled in `tsconfig.json`)
- Prefer interfaces for object shapes, types for unions and utilities
- Use `unknown` instead of `any` for external data
- Add JSDoc comments for exported functions

### React

- Use functional components with hooks
- Mark client components with `"use client"` directive
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use `React.memo` only when profiling shows a need

### Styling

- Use Tailwind CSS utility classes
- Use `cn()` from `lib/utils.ts` to merge class names
- Use `cva` for component variants
- Avoid inline styles unless dynamic values are required

### Error Handling

- Use `ApiError` and `AuthError` classes from `lib/auth.ts`
- Return consistent error responses: `{ error: { code, message, details? } }`
- Catch errors at the API route boundary
- Log errors with context (user ID, request path)

### Async/Await

- Use async/await instead of `.then()` chains
- Handle errors with try/catch
- Use `AbortSignal.timeout()` for fetch requests with timeouts

## Git Workflow

### Branch Naming

```
feature/description      : New features
fix/description          : Bug fixes
refactor/description     : Code refactoring
docs/description         : Documentation changes
test/description         : Test additions
chore/description        : Maintenance tasks
```

### Commit Messages

Use conventional commits:

```
feat: add bookmark support to notes
fix: resolve realtime SSE reconnection loop
refactor: extract task filtering into custom hook
docs: update API documentation for tasks endpoint
test: add E2E tests for habit logging flow
chore: upgrade Next.js to 15.3.0
```

### Commit Guidelines

- One logical change per commit
- Keep commits atomic and reversible
- Write the subject line in imperative mood ("add feature" not "added feature")
- Keep subject lines under 72 characters
- Add a body for complex changes explaining the "why"

### Before Pushing

1. Run `npm run typecheck`: Must pass
2. Run `npm run lint`: Must pass
3. Run `npm run test`: Must pass
4. Run `npm run test:e2e`: Must pass (for feature/fix branches)
5. Review your diff: `git diff --stat`

## PR Review Process

### Creating a PR

1. Push your branch to the remote
2. Open a PR against `main`
3. Fill in the PR template:
   - What does this PR do?
   - Why is this change needed?
   - How was it tested?
   - Screenshots (for UI changes)

### Review Checklist

Reviewers check:

- [ ] Code compiles without TypeScript errors
- [ ] Lint passes
- [ ] Tests pass (unit + E2E)
- [ ] Code follows project conventions
- [ ] No unnecessary dependencies added
- [ ] Error handling is complete
- [ ] UI is accessible (keyboard navigation, ARIA labels)
- [ ] Documentation updated (if API changed)

### Merging

- PRs require at least one approval
- All CI checks must pass
- Squash merge preferred for clean history
- Delete the branch after merging

## Common Tasks

### Adding a New API Endpoint

1. Create a directory under `apps/web/app/api/`:

   ```bash
   mkdir apps/web/app/api/bookmarks
   ```

2. Create `route.ts`:

   ```typescript
   import { NextRequest, NextResponse } from "next/server";
   import { withAuth } from "@/lib/auth";
   import { createPocketBaseClient } from "@/lib/pocketbase";

   export const GET = withAuth(async (request: NextRequest, user) => {
     const pb = createPocketBaseClient();
     const result = await pb.collection("bookmarks").getList(1, 50);
     return NextResponse.json(result);
   });

   export const POST = withAuth(async (request: NextRequest, user) => {
     const body = await request.json();
     const pb = createPocketBaseClient();
     const bookmark = await pb.collection("bookmarks").create(body);
     return NextResponse.json(bookmark, { status: 201 });
   });
   ```

3. For dynamic routes, create `[id]/route.ts`:

   ```typescript
   export const GET = withAuth(async (request: NextRequest, user, context: { params: { id: string } }) => {
     const { id } = await context.params;
     const pb = createPocketBaseClient();
     const bookmark = await pb.collection("bookmarks").getOne(id);
     return NextResponse.json(bookmark);
   });
   ```

### Adding a New Zustand Store

```typescript
// apps/web/lib/stores/use-bookmarks-store.ts
import { create } from "zustand";

interface Bookmark {
  id: string;
  title: string;
  url: string;
}

interface BookmarksState {
  bookmarks: Bookmark[];
  loading: boolean;
  fetchBookmarks: () => Promise<void>;
  addBookmark: (bookmark: Bookmark) => void;
}

export const useBookmarksStore = create<BookmarksState>((set) => ({
  bookmarks: [],
  loading: false,

  fetchBookmarks: async () => {
    set({ loading: true });
    const response = await fetch("/api/bookmarks");
    const data = await response.json();
    set({ bookmarks: data.items, loading: false });
  },

  addBookmark: (bookmark) =>
    set((state) => ({
      bookmarks: [...state.bookmarks, bookmark],
    })),
}));
```

### Adding a New MCP Tool

1. Add the tool to the appropriate file in `apps/web/lib/mcp/tools/`:

   ```typescript
   // apps/web/lib/mcp/tools/bookmarks.ts
   server.tool("create_bookmark", "Create a new bookmark", {
     title: z.string(),
     url: z.string().url(),
     note_id: z.string().optional(),
   }, async (args) => {
     try {
       const bookmark = await pb.collection("bookmarks").create({
         title: args.title,
         url: args.url,
         note_id: args.note_id || "",
       });
       return textContent(JSON.stringify({ success: true, bookmark }));
     } catch (error) {
       return textContent(JSON.stringify({ success: false, error: String(error) }));
     }
   });
   ```

2. Register the tool in `apps/web/lib/mcp/server.ts`:

   ```typescript
   import { registerBookmarkTools } from "./tools/bookmarks";
   // ...
   registerBookmarkTools(server);
   ```

### Adding a New Background Job Type

1. Add a case to the worker's `processJob` function in `worker/index.ts`:

   ```typescript
   case "send_notification":
     await handleSendNotification(job);
     break;
   ```

2. Implement the handler:

   ```typescript
   async function handleSendNotification(job: QueueJob): Promise<void> {
     const payload = job.payload as { user_id: string; message: string };
     const pb = createAdminClient();
     await pb.collection("notifications").create({
       user_id: payload.user_id,
       message: payload.message,
       type: "info",
       read: false,
     });
   }
   ```

3. Schedule the job from your API route or service:

   ```typescript
   await pb.collection("queue_jobs").create({
     type: "send_notification",
     queue: "default",
     payload: { user_id: "user123", message: "Task completed" },
     status: "pending",
     retry_count: 0,
     max_retries: 3,
     scheduled_at: new Date().toISOString(),
   });
   ```
