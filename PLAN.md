Project E — Full Review, Functional Completion & CI/CD Plan
What we know
Actual stack: Vite + React 19 + TanStack Router/Query + shadcn/ui SPA (apps/web) · Hono/Bun API (apps/api) · Bun worker · Drizzle/Postgres. README/AGENTS.md describe a Next.js app that no longer exists — docs are stale.
Deployment: docker-compose on the projecte host (10.0.0.204): db, api, spa (Caddy), worker. Secrets come from a host .env (already/soon exists). Remote = git.buzzbee.dev (Gitea).
CI/CD: No workflows exist yet. Will add Gitea Actions (.gitea/workflows/) using runner label projecte-runner, deploy = docker compose on the same host, triggered by push to main + manual dispatch.
Phase 0 — CI/CD foundation (do first, so everything after ships through it)
.gitea/workflows/ci.yml with two jobs:
quality (every push + PR): bun install --frozen-lockfile → typecheck (api + worker + web) → vite build → docker compose build (catches Dockerfile breakage early).
deploy (push to main + workflow_dispatch): docker compose build → apply migrations → docker compose up -d → health checks (SPA 200, /api/health DB ping, login smoke via POST /api/auth/credentials).
Deploy job runs on projecte-runner; uses host .env for secrets; keeps previous image tags for rollback.
Migration story — currently broken: db:push doesn't apply drizzle/*.sql, README references a non-existent drizzle/0000_postgres.sql, and 0005 is hand-written. Reconcile: verify the 5 migration files reproduce the .migration-baseline-schema.sql schema, make a single idempotent db:migrate script, and call it in the deploy job before up -d.
Docs refresh: rewrite README, AGENTS.md, DEPLOY.md to describe the real stack, deploy flow, and Gitea Actions pipeline.
Conventions to fix first (they gate everything): implement requireWorkspaceAccess() per AGENTS.md, a shared recordActivity wrapper that always derives workspaceId correctly, and a shared error helper — then phases 1–4 build on them.
Phase 1 — Critical functional fixes (app must stop lying)
#	Fix	Where
1	Calendar delete — useApiMutation("delete", "", …) → DELETE /api 404. Use DELETE /calendar/events/{id} + wire drag/resize handlers + enable withDragAndDrop	calendar.tsx:173
2	Canvas persistence — blocks are local state; handleSave sends only {name}. Add canvas-card CRUD endpoints (API), persist blocks (content/type/order), load on open, save on debounce, route detail page through it	canvas.tsx:243, API routes/canvas.ts
3	Logout — no POST /api/auth/logout; cookie never cleared. Add route that clears the session cookie; client already calls it in 3 places	API routes/auth.ts, sidebar.tsx
4	Graph edge write/delete 500 — recordActivity({ workspaceId: "" }) → invalid uuid. Derive domain from the edge	API routes/graph.ts:150,190
5	Analytics fake data — replace Math.random() with real endpoints; fix /analytics/habits domain scoping; make /analytics/projects real; real CSV export	analytics.tsx:137, API routes/analytics.ts
6	Task board DnD — add droppable columns, persist status change + order via API	tasks.tsx:215
7	Notes editor — wire installed Tiptap (replace contentEditable): autosave debounce, placeholder fix, stop stopPropagation killing shortcuts, render HTML on detail page (use editor output, not raw innerHTML text)	notes.tsx, notes/$id.tsx
8	Passkey security hole — authenticates without verifying signature. Either implement real WebAuthn verification or remove the passkey surface	API routes/auth.ts:115
9	Domain/owner scoping (IDOR) — add owner/domain checks to all by-ID GET/PATCH/DELETE routes; scope /api/search and /api/export to active domain	all API routes
10	Command palette routing — singular vs plural types → non-existent /search/{id}. Fix type→route map; fix @mention agent fetch (response is {items}, q ignored)	command-palette.tsx:313
11	Agent activity SSE handler — wrong event type match + data.payload doesn't exist; would crash on match	agents/activity.tsx:54
12	Graph fly-to — centerAt(undefined, undefined) on raw nodes (no x/y). Track positions via onNodeDrag or search the rendered graph data	graph.tsx:157
Phase 2 — UX & polish pass (current shadcn look, elevated)
Rebuild login on the design system: Input/Button/Label, autofocus, loading/disabled state, error styling, branding mark. (Worst screen in the app today.)
Feedback everywhere: mount Sonner <Toaster/>; add success/error toasts to every create/update/delete mutation; inline error handling on failed mutations.
State coverage: shared LoadingState (skeleton), EmptyState (icon + text + CTA), ErrorState components; apply to every page (calendar, graph, analytics, settings tabs, search, agents…).
Settings honesty: implement density (CSS variable that actually changes spacing), wire sidebarPos to reposition the sidebar, add real reduce-motion CSS — or remove the controls.
Typography: add a real font via --font-sans (self-hosted or Google Fonts) — currently browser-default only.
Consolidate color maps: one shared src/lib/status-colors.ts (status/priority/entity colors as semantic tokens) replacing 8+ divergent copies; make accent theming actually visible.
Unify detail routes (tasks/$id, habits/$id, projects/$id, notes/$id, canvas/$id) with the app design language; make list UIs link to them.
Dashboard: fix sort=dueDate→due_date (widget shows wrong tasks), align realtime invalidation keys with widget query keys, make widget grid responsive.
Responsive: notes/graph/settings panes on mobile, dashboard grid stacking, calendar height.
A11y: aria-labels on icon/scale buttons, radiogroup for mood/energy, fix dangerouslySetInnerHTML snippet XSS surface (sanitize <mark>), notification badge label.
Phase 3 — Secondary feature completion
Canvas: persist block editor (from Phase 1) + real save UX + delete blocks/cards.
Daily notes: timezone bug (UTC midnight stored, local day shown), add DELETE /api/daily-notes/:id, autosave cleanup, mood/energy before content creates the note.
Graph: domain picker (shared with topbar), node detail → navigable entity links.
Analytics: real charts (tasks completed over time, created vs completed, habit consistency, project progress, time per domain, productivity heatmap) + honest empty states + working CSV.
Domains: active-domain selection store + picker; API already supports multi-domain.
Tags: assign/remove tags on tasks/habits/notes from the UI (currently create-only); fix in-memory tag filter after pagination.
Import/Export: scope export to domain (currently exports every user's data), implement advertised CSV format, validate import.
Custom fields: decide and wire to entities, or hide if inert.
Phase 4 — Advanced features (selected; largest phase)
Webhooks pipeline: enqueue webhook_delivery jobs on entity events; fix POST /webhooks/:id/test; worker already knows how to deliver — just wire the queue.
Recurring tasks: create scheduledJobs from recurrenceRule; worker recurring_spawn already exists — wire creation.
Agents: real CRUD UI, permission editing, activity filters (from/to/action honored server-side).
Notifications: real notification count/feed instead of hardcoded 0.
Reports & Milestones: minimal working versions, or remove from nav until built (recommend: build minimal).
MCP polish: validation, correct error codes, domain scoping, drop the dead ?? sql`` `` `` `` leftover.
Worker: wire ai_dispatch or mark it disabled.
Phase 5 — E2E rewrite + docs
Rewrite the Playwright suite (e2e/*.spec.ts) for the new SPA: auth cookie flow, tasks/habits/projects/notes/calendar/canvas/daily/graph/search/analytics/settings/agents-activity; new auth helper; drop specs for removed features (reports/mcp UI).
CI: dedicated ephemeral Postgres + dev servers for E2E, run chromium only in CI (full 5-browser matrix locally/on demand); npx playwright install --with-deps chromium on the runner.
Update docs/API.md to match reality.
Risks & mitigations
Huge scope → sequenced phases; each phase lands on main and deploys independently, so value ships incrementally.
DB migrations on live prod data → Phase 0 makes migrations idempotent + verifiable before any deploy; backup volume (project-e-pg-data) noted in DEPLOY.md.
E2E against prod → E2E runs in CI against an ephemeral test DB, never prod.
Secrets → host .env (gitignored), never committed; Gitea Actions secrets only if needed later.
DnD persistence + Tiptap are the two most invasive frontend changes → done early (Phase 1) so regressions surface in CI before polish.
Verification
Per user: CI + manual testing — quality job gates every push (typecheck/build/docker build); deploy job gates main; you verify on the live site (10.0.0.204:3000) after each deploy. E2E suite (Phase 5) becomes the automated gate once rewritten.
