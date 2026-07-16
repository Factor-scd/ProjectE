import { EventEmitter } from 'events';

// Create a singleton event bus
class EventBus extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for high-traffic scenarios
    this.setMaxListeners(100);
  }
}

export const eventBus = new EventBus();

// Event type definitions
export interface TaskCompletedEvent {
  taskId: string;
  taskTitle: string;
  projectId?: string;
  domain: string;
  userId: string;
}

export interface HabitCompletedEvent {
  habitId: string;
  habitTitle: string;
  date: string;
  domain: string;
  userId: string;
}

export interface HabitStreakBrokenEvent {
  habitId: string;
  habitTitle: string;
  previousStreak: number;
  domain: string;
  userId: string;
}

export interface MilestoneReachedEvent {
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  domain: string;
  userId: string;
}

export interface ProjectStatusChangedEvent {
  projectId: string;
  projectTitle: string;
  oldStatus: string;
  newStatus: string;
  domain: string;
  userId: string;
}

export interface ReportGeneratedEvent {
  reportId: string;
  reportTitle: string;
  reportType: string;
  domain: string;
  userId: string;
}

export interface AgentTaskCompletedEvent {
  agentTaskId: string;
  agentId: string;
  entityType: string;
  entityId: string;
  userId: string;
}

// Event names as constants
export const EVENTS = {
  TASK_COMPLETED: 'task.completed',
  HABIT_COMPLETED: 'habit.completed',
  HABIT_STREAK_BROKEN: 'habit.streak_broken',
  MILESTONE_REACHED: 'milestone.reached',
  PROJECT_STATUS_CHANGED: 'project.status_changed',
  REPORT_GENERATED: 'report.generated',
  AGENT_TASK_COMPLETED: 'agent_task.completed',
} as const;

// Type-safe emit helper
export function emitEvent<T>(event: string, data: T): void {
  eventBus.emit(event, data);
}

// Type-safe listener helper
export function onEvent<T>(event: string, handler: (data: T) => void): () => void {
  eventBus.on(event, handler);
  return () => eventBus.off(event, handler);
}
