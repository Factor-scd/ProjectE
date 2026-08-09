# Project E — Web SPA

The frontend SPA for Project E, built with React 19, TanStack Router, and Vite.

## Architecture

```
apps/web/
├── src/
│   ├── components/
│   │   ├── shell/          # App shell: Sidebar, Topbar, CommandPalette, ShortcutsHelp, ThemeProvider
│   │   ├── ui/             # shadcn/ui primitives (button, dialog, input, etc.)
│   │   └── entities/       # Entity-specific components (detail panels, forms)
│   ├── hooks/              # Custom hooks (use-keyboard-shortcuts, use-realtime)
│   ├── lib/
│   │   ├── api.ts          # Typed API client + React Query hooks
│   │   ├── stores/         # Zustand stores (theme, sidebar, keyboard-shortcuts, create-dialog)
│   │   ├── types/          # Shared TypeScript types
│   │   └── utils.ts        # cn() utility
│   ├── routes/             # TanStack Router file-based routes
│   │   ├── __root.tsx      # Root layout
│   │   ├── _app.tsx        # Authenticated app layout (sidebar + topbar + palette)
│   │   ├── login.tsx       # Login page
│   │   └── _app/           # All app pages
│   ├── main.tsx            # Entry point
│   ├── routeTree.ts        # Auto-generated route tree
│   └── index.css           # Tailwind + CSS variables
└── dist/                   # Production build output
```

## Pages (14 routes)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Configurable widget grid (8 widget types) |
| `/tasks` | Tasks | Full CRUD with filters, sort, kanban view |
| `/habits` | Habits | Track habits with streaks, completions |
| `/projects` | Projects | Project management with sections |
| `/notes` | Notes | Rich text notes with backlinks |
| `/calendar` | Calendar | react-big-calendar with DnD, date-fns localizer |
| `/graph` | Graph | react-force-graph-2d with custom renderers |
| `/search` | Search | Full-text search across entities |
| `/analytics` | Analytics | 6 chart types (recharts) |
| `/agents/activity` | Agent Activity | SSE live activity feed |
| `/canvas` | Canvas | Block-based editor |
| `/daily` | Daily Notes | Journal with calendar sidebar |
| `/settings` | Settings | 9 tabs (profile, domains, agents, webhooks, etc.) |
| `/login` | Login | Authentication |

## OSS Components

- **Calendar:** `react-big-calendar` v1.20 with `withDragAndDrop` HOC, date-fns localizer, custom event renderer with color tokens, custom toolbar, responsive (agenda on mobile)
- **Graph:** `react-force-graph-2d` v1.29 with custom node/link canvas renderers, hover highlighting, search-to-fly, filter panel (entity + relationship types), ResizeObserver, 500-node cap
- **Command Palette:** `cmdk` v1.1 with recent items, @mention agent search, theme/settings actions, mobile full-screen
- **Shortcuts:** `@github/hotkey` v3.1 for global keyboard shortcuts (g+letter nav, n+letter create, ?, /, c)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` / `Ctrl+K` | Open command palette |
| `g then d` | Go to Dashboard |
| `g then t` | Go to Tasks |
| `g then h` | Go to Habits |
| `g then p` | Go to Projects |
| `g then n` | Go to Notes |
| `g then c` | Go to Calendar |
| `g then g` | Go to Graph |
| `g then s` | Go to Settings |
| `n then t` | New task |
| `n then h` | New habit |
| `n then p` | New project |
| `n then n` | New note |
| `c` | Focus create in palette |
| `/` | Focus search |
| `?` | Show shortcuts help |

## Development

```bash
# Install dependencies
bun install

# Start dev server (port 3000)
bun run dev

# Production build
bun run build

# Preview production build
bun run preview

# Type check
bun run typecheck
```

## API

All API calls go through `/api/*` and are proxied to the Hono backend. The API client in `src/lib/api.ts` provides typed `get`/`post`/`put`/`patch`/`delete` methods plus React Query hooks (`useApiQuery`, `useApiMutation`).

## Bundle Size

- Total JS: ~1.2 MB (369 KB gzipped)
- CSS: ~53 KB (10 KB gzipped)
- Budget: < 1.5 MB gzipped
