/**
 * Shared semantic color tokens for entities (status, priority, type).
 *
 * Single source of truth — pages must import these instead of defining local
 * color maps. All values are Tailwind classes unless the comment says otherwise.
 */

export interface StatusToken {
  label: string;
  /** Tailwind class for a small colored dot (e.g. `w-2 h-2 rounded-full`). */
  dot: string;
  /** Tailwind classes for a filled Badge (bg + text). */
  badge: string;
}

/** Task workflow statuses (board column dots + badges). */
export const TASK_STATUS: Record<string, StatusToken> = {
  todo: { label: "Todo", dot: "bg-slate-500", badge: "bg-slate-500 text-white" },
  in_progress: { label: "In Progress", dot: "bg-blue-500", badge: "bg-blue-500 text-white" },
  done: { label: "Done", dot: "bg-green-500", badge: "bg-green-500 text-white" },
  cancelled: { label: "Cancelled", dot: "bg-red-500", badge: "bg-red-500 text-white" },
};

/** Task priority. Badges use a soft tint (matching text + translucent bg). */
export const PRIORITY: Record<string, { label: string; badge: string }> = {
  low: { label: "Low", badge: "text-slate-500 bg-slate-500/10" },
  medium: { label: "Medium", badge: "text-blue-500 bg-blue-500/10" },
  high: { label: "High", badge: "text-orange-500 bg-orange-500/10" },
  urgent: { label: "Urgent", badge: "text-red-500 bg-red-500/10" },
};

/** Project lifecycle statuses. */
export const PROJECT_STATUS: Record<string, StatusToken> = {
  active: { label: "Active", dot: "bg-green-500", badge: "bg-green-500 text-white" },
  paused: { label: "Paused", dot: "bg-amber-500", badge: "bg-amber-500 text-white" },
  completed: { label: "Completed", dot: "bg-blue-500", badge: "bg-blue-500 text-white" },
  archived: { label: "Archived", dot: "bg-slate-500", badge: "bg-slate-500 text-white" },
};

/**
 * Graph node colors by entity type (hex).
 *
 * These are consumed by the canvas renderer (`ctx.fillStyle`) and inline
 * `style={{ backgroundColor }}` props. CSS variables don't work in canvas
 * `fillStyle`, so keep literal hex values here.
 */
export const ENTITY: Record<string, string> = {
  task: "#3b82f6",
  habit: "#10b981",
  project: "#8b5cf6",
  note: "#f59e0b",
  section: "#ec4899",
  tag: "#6b7280",
  domain: "#6366f1",
};

/**
 * Calendar event colors by entity type.
 *
 * Values are HSL triplets consumed as `hsl(${hue})` / `hsla(${hue}, 0.15)`.
 * `task` resolves through the theme accent (`var(--accent-hsl)`), so events
 * pick up the user's chosen accent color.
 */
export const CALENDAR_EVENT: Record<string, string> = {
  task: "var(--accent-hsl, 217 91% 60%)",
  habit: "142 71% 45%",
  project: "271 81% 56%",
  note: "24 95% 53%",
  default: "215 16% 47%",
};
