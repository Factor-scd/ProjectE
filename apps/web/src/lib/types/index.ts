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
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: Tag[];
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
  noteId: string;
  noteTitle: string;
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
