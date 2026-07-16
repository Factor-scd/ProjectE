// pocketbase/schema.ts
// TypeScript type definitions for PocketBase collections
// Used by API layer for type safety

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

export interface RecurringConfig {
  /** RRULE string */
  rule: string;
  next_due?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  sort_order: number;
}

/** Base PocketBase record fields present on every collection row. */
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

// ---------------------------------------------------------------------------
// System collections
// ---------------------------------------------------------------------------

export interface Domain extends BaseRecord {
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

export interface Tag extends BaseRecord {
  name: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Project collections
// ---------------------------------------------------------------------------

export interface Project extends BaseRecord {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  /** Relation → domains */
  domain: string;
  status: 'active' | 'paused' | 'archived';
  /** Relation → tags (multiple) */
  tags: string[];
  goal?: string;
  deadline?: string;
  progress: number;
  members?: unknown[];
}

export interface ProjectSettings extends BaseRecord {
  /** Relation → projects */
  project_id: string;
  default_priority?: 'low' | 'medium' | 'high' | 'urgent';
  /** Relation → domains */
  default_domain?: string;
  /** Relation → tags (multiple) */
  default_tags?: string[];
  auto_archive_completed_after_days?: number;
  default_view?: 'kanban' | 'list';
  habit_reminder_time_default?: string;
  pomodoro_focus_minutes: number;
  pomodoro_break_minutes: number;
  accent_color_override?: string;
  milestone_dependency_enforcement: boolean;
  custom_fields?: Record<string, unknown>;
}

export interface Milestone extends BaseRecord {
  title: string;
  description?: string;
  /** Relation → projects */
  project_id: string;
  status: 'planned' | 'in_progress' | 'complete';
  due_date?: string;
  sort_order: number;
}

export interface MilestoneDependency extends BaseRecord {
  /** Relation → milestones */
  milestone_id: string;
  /** Relation → milestones */
  depends_on_milestone_id: string;
}

export interface MilestoneTemplate extends BaseRecord {
  name: string;
  description?: string;
  milestones: unknown[];
}

export interface MilestoneHistory extends BaseRecord {
  /** Relation → milestones */
  milestone_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
  changed_at: string;
}

// ---------------------------------------------------------------------------
// Task collections
// ---------------------------------------------------------------------------

export interface Task extends BaseRecord {
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  /** Relation → projects */
  project_id?: string;
  /** Relation → milestones */
  milestone_id?: string;
  /** Relation → tags (multiple) */
  tags: string[];
  /** Relation → domains */
  domain: string;
  assignee?: string;
  estimate?: number;
  time_spent: number;
  recurring_config?: RecurringConfig;
  attachments: Attachment[];
  dependencies: string[];
  subtasks: Subtask[];
  custom_fields?: Record<string, unknown>;
  completed_at?: string;
}

export interface TaskSubtask extends BaseRecord {
  /** Relation → tasks */
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
}

export interface TaskDependency extends BaseRecord {
  /** Relation → tasks */
  task_id: string;
  /** Relation → tasks */
  depends_on_task_id: string;
}

export interface TaskAttachment extends BaseRecord {
  /** Relation → tasks */
  task_id: string;
  /** File reference */
  file: string;
  filename?: string;
  mime_type?: string;
  size?: number;
}

export interface TaskTimeEntry extends BaseRecord {
  /** Relation → tasks */
  task_id: string;
  duration: number;
  started_at?: string;
  ended_at?: string;
  source: 'manual' | 'timer' | 'pomodoro';
  notes?: string;
}

// ---------------------------------------------------------------------------
// Habit collections
// ---------------------------------------------------------------------------

export interface Habit extends BaseRecord {
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'custom';
  cron_expression?: string;
  target_count: number;
  streak_current: number;
  streak_best: number;
  last_completed_at?: string;
  /** Relation → projects */
  project_id?: string;
  /** Relation → tags (multiple) */
  tags: string[];
  /** Relation → domains */
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mood_tracking: boolean;
  reminder_times?: string[];
  skip_days?: string[];
  unit?: string;
  goal_per_period?: number;
  score: number;
  score_config?: Record<string, unknown>;
  completion_mode: 'quick' | 'detailed';
}

export interface HabitLog extends BaseRecord {
  /** Relation → habits */
  habit_id: string;
  date: string;
  mood?: string;
  quantity?: number;
  notes?: string;
}

export interface HabitSkipDay extends BaseRecord {
  /** Relation → habits */
  habit_id: string;
  date: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Note collections
// ---------------------------------------------------------------------------

export interface Note extends BaseRecord {
  title: string;
  content?: string;
  /** Relation → domains */
  domain: string;
  /** Relation → tags (multiple) */
  tags: string[];
  linked_entities?: unknown[];
  created_by?: string;
  ai_generated: boolean;
  bookmarked: boolean;
  pinned: boolean;
  frontmatter?: Record<string, unknown>;
  wikilinks?: string[];
}

export interface NoteLink extends BaseRecord {
  /** Relation → notes */
  source_note_id: string;
  /** Relation → notes */
  target_note_id: string;
  link_text?: string;
}

export interface NoteTaskLink extends BaseRecord {
  /** Relation → notes */
  note_id: string;
  /** Relation → tasks */
  task_id: string;
  checkbox_position: number;
}

// ---------------------------------------------------------------------------
// Report collections
// ---------------------------------------------------------------------------

export interface ReportTemplate extends BaseRecord {
  name: string;
  description?: string;
  report_type: 'weekly' | 'monthly' | 'project' | 'habit' | 'custom';
  content_template?: string;
  is_builtin: boolean;
}

export interface Report extends BaseRecord {
  title: string;
  content?: string;
  report_type: 'weekly' | 'monthly' | 'project' | 'habit' | 'custom';
  date_range_start?: string;
  date_range_end?: string;
  generated_by?: string;
  ai_generated: boolean;
  linked_entities?: unknown[];
  /** Relation → domains */
  domain: string;
  /** Relation → tags (multiple) */
  tags: string[];
  /** Relation → report_templates */
  template_id?: string;
}

// ---------------------------------------------------------------------------
// Canvas collections
// ---------------------------------------------------------------------------

export interface Canvas extends BaseRecord {
  name: string;
  mode: 'freeform' | 'graph';
  /** Relation → projects */
  project_id?: string;
  state?: Record<string, unknown>;
}

export interface CanvasCard extends BaseRecord {
  /** Relation → canvases */
  canvas_id: string;
  card_type: 'note' | 'task' | 'image' | 'entity';
  entity_id?: string;
  entity_type?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  content?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent collections
// ---------------------------------------------------------------------------

export interface Agent extends BaseRecord {
  name: string;
  api_key: string;
  avatar?: string;
  description?: string;
  permission_tier:
    | 'full_access'
    | 'read_only'
    | 'content_creator'
    | 'task_manager'
    | 'custom';
  custom_permissions?: Record<string, unknown>;
  webhook_url?: string;
  last_activity_at?: string;
  status: 'active' | 'disabled';
}

export interface AgentActivity extends BaseRecord {
  /** Relation → agents */
  agent_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  prompt?: string;
  response?: string;
}

// ---------------------------------------------------------------------------
// Webhook collections
// ---------------------------------------------------------------------------

export interface Webhook extends BaseRecord {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
}

export interface WebhookDelivery extends BaseRecord {
  /** Relation → webhooks */
  webhook_id: string;
  event_type: string;
  payload?: Record<string, unknown>;
  response_status?: number;
  response_body?: string;
  success: boolean;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Agent task collection
// ---------------------------------------------------------------------------

export interface AgentTask extends BaseRecord {
  /** Relation → agents */
  agent_id: string;
  entity_type: string;
  entity_id: string;
  instruction: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'delivery_failed';
  result?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// System collections
// ---------------------------------------------------------------------------

export interface Notification extends BaseRecord {
  title: string;
  message?: string;
  type: 'info' | 'success' | 'warning' | 'error';
  entity_type?: string;
  entity_id?: string;
  read: boolean;
}

export interface ErrorLog extends BaseRecord {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  stack_trace?: string;
  source?: string;
}

export interface QueueJob extends BaseRecord {
  job_type: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  error?: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
}

// ---------------------------------------------------------------------------
// Collection names & type map
// ---------------------------------------------------------------------------

export type CollectionName =
  | 'domains'
  | 'tags'
  | 'projects'
  | 'project_settings'
  | 'milestones'
  | 'milestone_dependencies'
  | 'milestone_templates'
  | 'milestone_history'
  | 'tasks'
  | 'task_subtasks'
  | 'task_dependencies'
  | 'task_attachments'
  | 'task_time_entries'
  | 'habits'
  | 'habit_logs'
  | 'habit_skip_days'
  | 'notes'
  | 'note_links'
  | 'note_task_links'
  | 'report_templates'
  | 'reports'
  | 'canvases'
  | 'canvas_cards'
  | 'agents'
  | 'agent_activity'
  | 'webhooks'
  | 'webhook_deliveries'
  | 'agent_tasks'
  | 'notifications'
  | 'error_logs'
  | 'queue_jobs';

/** Maps each PocketBase collection name to its corresponding TypeScript type. */
export interface CollectionTypes {
  domains: Domain;
  tags: Tag;
  projects: Project;
  project_settings: ProjectSettings;
  milestones: Milestone;
  milestone_dependencies: MilestoneDependency;
  milestone_templates: MilestoneTemplate;
  milestone_history: MilestoneHistory;
  tasks: Task;
  task_subtasks: TaskSubtask;
  task_dependencies: TaskDependency;
  task_attachments: TaskAttachment;
  task_time_entries: TaskTimeEntry;
  habits: Habit;
  habit_logs: HabitLog;
  habit_skip_days: HabitSkipDay;
  notes: Note;
  note_links: NoteLink;
  note_task_links: NoteTaskLink;
  report_templates: ReportTemplate;
  reports: Report;
  canvases: Canvas;
  canvas_cards: CanvasCard;
  agents: Agent;
  agent_activity: AgentActivity;
  webhooks: Webhook;
  webhook_deliveries: WebhookDelivery;
  agent_tasks: AgentTask;
  notifications: Notification;
  error_logs: ErrorLog;
  queue_jobs: QueueJob;
}
