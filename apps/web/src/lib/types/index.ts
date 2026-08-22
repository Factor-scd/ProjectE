// Shared types for Project E entities

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
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
  dependencies?: { id: string; title: string; status: string }[];
  dependents?: { id: string; title: string; status: string }[];
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

export interface Notification {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
}

export interface NotificationsResponse {
  items: Notification[];
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
  totalExpected?: number;
  perHabit?: Array<{ id: string; name: string; completed: number; expected: number; consistency: number }>;
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

