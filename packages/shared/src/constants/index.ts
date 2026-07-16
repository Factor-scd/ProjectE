// ── Task ─────────────────────────────────────────────────────────────────────

export const TASK_STATUS = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

// ── Habit ────────────────────────────────────────────────────────────────────

export const HABIT_FREQUENCY = ['daily', 'weekly', 'custom'] as const;
export const HABIT_DIFFICULTY = ['easy', 'medium', 'hard'] as const;
export const HABIT_COMPLETION_MODE = ['quick', 'detailed'] as const;

// ── Project ──────────────────────────────────────────────────────────────────

export const PROJECT_STATUS = ['active', 'paused', 'archived'] as const;

// ── Milestone ────────────────────────────────────────────────────────────────

export const MILESTONE_STATUS = ['planned', 'in_progress', 'complete'] as const;

// ── Report ───────────────────────────────────────────────────────────────────

export const REPORT_TYPE = ['weekly', 'monthly', 'project', 'habit', 'custom'] as const;

// ── Canvas ───────────────────────────────────────────────────────────────────

export const CANVAS_MODE = ['freeform', 'graph'] as const;
export const CANVAS_CARD_TYPE = ['note', 'task', 'image', 'entity'] as const;

// ── Agent ────────────────────────────────────────────────────────────────────

export const AGENT_PERMISSION_TIER = [
  'full_access',
  'read_only',
  'content_creator',
  'task_manager',
  'custom',
] as const;
export const AGENT_STATUS = ['active', 'disabled'] as const;

// ── System ───────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE = ['info', 'success', 'warning', 'error'] as const;
export const QUEUE_JOB_STATUS = ['pending', 'in_progress', 'completed', 'failed'] as const;
export const TIME_ENTRY_SOURCE = ['manual', 'timer', 'pomodoro'] as const;

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS = {
  TASK_PRIORITY: 'medium',
  TASK_STATUS: 'todo',
  HABIT_FREQUENCY: 'daily',
  HABIT_DIFFICULTY: 'medium',
  HABIT_COMPLETION_MODE: 'quick',
  PROJECT_STATUS: 'active',
  MILESTONE_STATUS: 'planned',
  POMODORO_FOCUS_MINUTES: 25,
  POMODORO_BREAK_MINUTES: 5,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_RETRIES: 3,
} as const;

// ── Default Domains ──────────────────────────────────────────────────────────

export const DEFAULT_DOMAINS = [
  { name: 'personal', color: '#299667', icon: '🏠', sort_order: 0 },
  { name: 'work', color: '#356bff', icon: '💼', sort_order: 1 },
  { name: 'ots', color: '#ea7658', icon: '🛒', sort_order: 2 },
] as const;
