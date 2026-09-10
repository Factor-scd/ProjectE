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

/** Task workflow statuses (board column dots + badges) — Buzzbee tints. */
export const TASK_STATUS: Record<string, StatusToken> = {
  todo: { label: "Todo", dot: "bg-slate-400", badge: "bg-[#f1f1f1] text-[#2e2e2e] border border-[#dbdbdb]" },
  in_progress: { label: "In Progress", dot: "bg-[#1677ff]", badge: "bg-[#e6f4ff] text-[#002c8c] border border-[#91caff]" },
  done: { label: "Done", dot: "bg-[#52c41a]", badge: "bg-[#f6ffed] text-[#135200] border border-[#b6eb8f]" },
  cancelled: { label: "Cancelled", dot: "bg-[#ff4d4f]", badge: "bg-[#fff2f0] text-[#820014] border border-[#ffccc7]" },
};

/** Task priority. Badges use a soft tint (matching text + translucent bg). */
export const PRIORITY: Record<string, { label: string; badge: string }> = {
  low: { label: "Low", badge: "text-slate-600 bg-slate-500/15" },
  medium: { label: "Medium", badge: "text-blue-600 bg-blue-500/15" },
  high: { label: "High", badge: "text-orange-600 bg-orange-500/15" },
  urgent: { label: "Urgent", badge: "text-red-600 bg-red-500/15" },
};

/** Project lifecycle statuses — Buzzbee tints. */
export const PROJECT_STATUS: Record<string, StatusToken> = {
  active: { label: "Active", dot: "bg-[#52c41a]", badge: "bg-[#f6ffed] text-[#135200] border border-[#b6eb8f]" },
  paused: { label: "Paused", dot: "bg-[#faad14]", badge: "bg-[#fffbe6] text-[#874c00] border border-[#ffe58f]" },
  completed: { label: "Completed", dot: "bg-[#1677ff]", badge: "bg-[#e6f4ff] text-[#002c8c] border border-[#91caff]" },
  archived: { label: "Archived", dot: "bg-slate-400", badge: "bg-[#f1f1f1] text-[#646464] border border-[#dbdbdb]" },
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
  task: "var(--accent-hsl, 216 100% 54%)",
  habit: "142 71% 45%",
  project: "271 81% 56%",
  note: "24 95% 53%",
  default: "215 16% 47%",
};
