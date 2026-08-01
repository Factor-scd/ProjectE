# Phase 4 Notes (T6)

## Pages built
- **Tasks** (`/tasks`): Kanban board with dnd-kit drag-and-drop between 4 status columns (Todo, In Progress, Done, Cancelled) + List view with TanStack Table. Create/edit via dialog/side panel. Optimistic updates via TanStack Query mutations.
- **Habits** (`/habits`): List with streak display, 7-day mini completion grid, "Mark complete" button. Create/edit via dialog/side panel. History tab shows completion log.
- **Projects** (`/projects`): Card grid with progress bars. Detail panel with Overview/Tasks/Sections tabs. Create/edit via dialog.
- **Notes** (`/notes`): Two-pane layout (list + contentEditable editor). Backlinks and version history toggles. Auto-save on 500ms debounce.
- **Calendar** (`/calendar`): Month grid with date-fns. Events from API displayed with color coding. Create/edit/delete via dialogs.
- **Graph** (`/graph`): SVG-based circular layout visualization. Filter panel for entity types. Node detail panel. Full react-force-graph-2d integration deferred to T8.
- **Search** (`/search`): Debounced cross-entity search. Type filter chips. Recent searches in localStorage. Results grouped by type with highlighted snippets.

## Shared infrastructure
- `src/hooks/use-realtime.ts`: SSE hook subscribing to `/api/realtime` with exponential backoff reconnect. Invalidates TanStack Query caches on entity events.
- `src/components/entities/entity-detail-panel.tsx`: Reusable Sheet-based side panel.
- `src/lib/types/index.ts`: Shared TypeScript interfaces for all entities.

## Packages installed
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder, @tiptap/extension-mention, @tiptap/extension-task-list, @tiptap/extension-task-item, @tiptap/extension-link, @tiptap/extension-code-block-lowlight, @tiptap/pm, @tiptap/suggestion
- recharts
- react-big-calendar
- react-force-graph-2d
- react-hook-form, @hookform/resolvers
- @tanstack/react-table
- date-fns

## Notes for T7
- useApiQuery / useApiMutation patterns in `src/lib/api.ts` are the standard for all data fetching
- EntityDetailPanel in `src/components/entities/` is reusable for any entity
- Forms use controlled state (not react-hook-form yet - T7 can upgrade)
- Calendar and Graph use basic implementations; T8 will formalize with react-big-calendar and react-force-graph-2d
- TipTap is installed but Notes page uses a simple contentEditable for now; T7/T8 can upgrade to full TipTap
