import { createPocketBaseClient, createAdminClient } from '../pocketbase';
import type { Task, Subtask } from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asTask(record: Record<string, unknown>): Task {
  return record as unknown as Task;
}

/**
 * Calculate task progress from subtask completion ratio
 */
export function calculateTaskProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;
  const done = subtasks.filter((s) => s.done).length;
  return Math.round((done / subtasks.length) * 100);
}

/**
 * Check if a task is blocked by dependencies
 * Returns array of blocking task IDs
 */
export async function getBlockingDependencies(
  taskId: string,
  dependencies: string[]
): Promise<string[]> {
  if (dependencies.length === 0) return [];

  const pb = createAdminClient();
  const blocking: string[] = [];

  for (const depId of dependencies) {
    const depTask = asTask(
      await pb.collection('tasks').getOne(depId)
    );
    if (depTask.status !== 'done') {
      blocking.push(depId);
    }
  }

  return blocking;
}

/**
 * Check dependency gating — can this task be started?
 */
export async function canStartTask(
  taskId: string,
  dependencies: string[]
): Promise<{ allowed: boolean; blockedBy: string[] }> {
  const blockedBy = await getBlockingDependencies(taskId, dependencies);
  return {
    allowed: blockedBy.length === 0,
    blockedBy,
  };
}

/**
 * Handle task completion — trigger recurring task spawn if needed
 */
export async function completeTask(
  taskId: string,
  token?: string
): Promise<{ task: Task; nextRecurringTaskId?: string }> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Mark task as done
  const task = asTask(
    await pb.collection('tasks').update(taskId, {
      status: 'done',
      completed_at: new Date().toISOString(),
    })
  );

  let nextRecurringTaskId: string | undefined;

  // If recurring, spawn next occurrence
  if (task.recurring_config?.rule) {
    nextRecurringTaskId = await spawnNextRecurringTask(task);
  }

  return { task, nextRecurringTaskId };
}

/**
 * Spawn next recurring task from RRULE
 */
async function spawnNextRecurringTask(task: Task): Promise<string> {
  // Import rrule dynamically to avoid bundling issues
  const { RRule } = await import('rrule');

  const rule = RRule.fromString(task.recurring_config!.rule);
  const now = new Date();
  const nextDate = rule.after(now, true);

  if (!nextDate) {
    throw new Error('No next occurrence found for recurring task');
  }

  const pb = createAdminClient();

  // Create next occurrence
  const nextTask = await pb.collection('tasks').create({
    title: task.title,
    description: task.description || '',
    status: 'todo',
    priority: task.priority,
    due_date: nextDate.toISOString(),
    project_id: task.project_id || '',
    milestone_id: task.milestone_id || '',
    tags: task.tags || [],
    domain: task.domain,
    estimate: task.estimate || null,
    recurring_config: task.recurring_config,
    dependencies: task.dependencies || [],
    custom_fields: task.custom_fields || {},
  });

  return nextTask.id;
}

/**
 * Promote a subtask to a full task
 */
export async function promoteSubtask(
  parentTaskId: string,
  subtaskId: string,
  token?: string
): Promise<Task> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Get parent task
  const parentTask = asTask(
    await pb.collection('tasks').getOne(parentTaskId)
  );

  // Find the subtask
  const subtasks = (parentTask.subtasks || []) as Subtask[];
  const subtask = subtasks.find((s) => s.id === subtaskId);

  if (!subtask) {
    throw new Error('Subtask not found');
  }

  // Create new task from subtask
  const newTask = await pb.collection('tasks').create({
    title: subtask.title,
    description: '',
    status: subtask.done ? 'done' : 'todo',
    priority: parentTask.priority,
    project_id: parentTask.project_id || '',
    domain: parentTask.domain,
    tags: parentTask.tags || [],
  });

  // Remove subtask from parent
  const updatedSubtasks = subtasks.filter((s) => s.id !== subtaskId);
  await pb.collection('tasks').update(parentTaskId, {
    subtasks: updatedSubtasks,
  });

  return asTask(newTask as unknown as Record<string, unknown>);
}

/**
 * Auto-compute parent task progress from subtask completion
 */
export async function updateTaskProgress(
  taskId: string,
  token?: string
): Promise<number> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();
  const task = asTask(await pb.collection('tasks').getOne(taskId));

  const subtasks = (task.subtasks || []) as Subtask[];
  return calculateTaskProgress(subtasks);
}
