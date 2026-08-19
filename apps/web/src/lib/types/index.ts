// Shared types for Project E entities

export type TaskStatusCategory = "todo" | "in_progress" | "done" | "cancelled";

/** A per-project workflow status definition. */
export interface StatusDefinition {
  id: string;
  projectId: string;
  /** Stable machine key unique per project, e.g. "in_review". */
  key: string;
  /** Display label, e.g. "In Review". */
  label: string;
  /** UI semantics: drives progress, board columns and completion checks. */
  category: TaskStatusCategory;
  /** Hex color, or null to fall back to the category color. */
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  statusId: string | null;
  /** The resolved status definition (null when unassigned or status deleted). */
  status: StatusDefinition | null;
  priority: "low" | "medium" | "high" | "urgent";
  domainId: string;
  projectId: string | null;
  sectionId: string | null;
  parentId: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  recurrenceRule: string | null;
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: Tag[];
  customFields?: Record<string, unknown>;
  subtasks?: Task[];
  dependencies?: TaskSummary[];
  dependents?: TaskSummary[];
}

/** Slim task row used in dependency lists. */
export interface TaskSummary {
  id: string;
  title: string;
  statusId: string | null;
  status: StatusDefinition | null;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  domainId: string;
  frequency: "daily" | "weekly" | "custom";
  difficulty: "easy" | "medium" | "hard";
  goalPerPeriod: number;
  unit: string | null;
  reminderTime: string | null;
  skipDays: number[];
  moodTracking: boolean;
  active: boolean;
  streakCount: number;
  bestStreak: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: Tag[];
  recentCompletions?: HabitCompletion[];
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string;
  value: number;
  mood: number | null;
  notes: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  domainId: string;
  status: "active" | "paused" | "completed" | "archived";
  color: string | null;
  icon: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: Tag[];
  taskCount: number;
  completedCount: number;
  progress: number;
  /** This project's workflow status definitions (defaults seeded on create). */
  statuses?: StatusDefinition[];
  sections?: Section[];
  tasks?: Task[];
}

export interface Section {
  id: string;
  name: string;
  projectId: string;
  kind: "section" | "milestone";
  status: "planned" | "in_progress" | "complete";
  targetDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── Automation Rules ────────────────────────────────────────────────────────────

export type AutomationTriggerType = "task_status_changed" | "task_created" | "due_date_approaching";
export type AutomationActionType = "set_status" | "set_priority" | "add_label" | "create_notification";
export type AutomationConditionField = "project" | "status" | "priority" | "label";

export interface AutomationTrigger {
  type: AutomationTriggerType;
  params?: Record<string, unknown>;
}

export interface AutomationCondition {
  field: AutomationConditionField;
  op: string;
  value: unknown;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  projectId: string;
  name: string;
  active: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string | null;
  domainId: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: Tag[];
  backlinks?: Backlink[];
  outgoingLinks?: OutgoingLink[];
}

export interface Backlink {
  id: string;
  title: string;
  excerpt?: string;
}

export interface OutgoingLink {
  noteId: string;
  noteTitle: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  color: string | null;
  domainId: string;
  entityType: string | null;
  entityId: string | null;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  score: number;
  workspaceId: string;
  link: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  perPage: number;
  limit: number;
  offset: number;
}

export interface RealtimeEvent {
  type: string;
  action: string;
  id: string;
  workspace_id?: string;
}

// Dashboard
export interface DashboardWidget {
  id: string;
  userId: string;
  type: string;
  title: string | null;
  config: Record<string, unknown>;
  layout: { x: number; y: number; w: number; h: number };
  domainId: string;
  createdAt: string;
  updatedAt: string;
}

// Settings entities
export interface Domain {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  ownerId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
  entityType: string;
  domainId: string;
  required: boolean;
  options: string[];
  defaultValue: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  workspaceId: string;
  headers: Record<string, string> | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: string;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: string;
}

export interface ErrorLog {
  id: string;
  level: string;
  source: string;
  message: string;
  stackTrace: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "disabled";
  permissionTier: "full_access" | "read_only" | "content_creator" | "task_manager" | "custom";
  customPermissions: string[];
  domainId: string;
  tags: string[];
  config: Record<string, unknown>;
  apiKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = "mention" | "status_change" | "due_soon" | "automation" | "assignment" | (string & {});

export interface Notification {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  /** NULL = unread. */
  readAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface NotificationsResponse {
  items: Notification[];
  totalItems: number;
  unreadCount: number;
  page: number;
  perPage: number;
  limit: number;
  offset: number;
}

export interface NotificationCount {
  count: number;
}

export interface AgentActivity {
  id: string;
  agentId: string;
  action: string;
  description: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
}

// Canvas
export interface Canvas {
  id: string;
  name: string;
  description: string | null;
  mode: "freeform" | "graph";
  domainId: string;
  tags: string[];
  viewport: { x: number; y: number; zoom: number };
  background: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  cards?: CanvasCard[];
  connections?: CanvasConnection[];
}

export interface CanvasCard {
  id: string;
  canvasId: string;
  type: string;
  content: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  zIndex: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasConnection {
  id: string;
  canvasId: string;
  sourceCardId: string;
  targetCardId: string;
  label: string | null;
  color: string | null;
}

// Daily Notes
export interface DailyNote {
  id: string;
  date: string;
  content: string | null;
  domainId: string;
  mood: number | null;
  energy: number | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Analytics
export interface ProductivityData {
  taskCompletionRate: number;
  totalTasks: number;
  completedTasks: number;
  period: number;
}

export interface HabitAnalytics {
  habitConsistency: number;
  totalHabits: number;
  totalLogs: number;
  activeStreaks: number;
  bestStreak: number;
  period: number;
}

export interface DailyAnalyticsItem {
  date: string;
  created: number;
  completed: number;
}

export interface DailyAnalytics {
  items: DailyAnalyticsItem[];
  period: number;
}

export interface ProjectProgress {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
}

// Comments & activity (detail pages)
export interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  workspaceId: string;
  parentId: string | null;
  author: string;
  content: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
}

export interface ProjectAnalytics {
  projects: ProjectProgress[];
  totalProjects: number;
  period: number;
}

