import { createPocketBaseClient, createAdminClient } from '../pocketbase';
import type { Project, Task, Milestone } from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asProject(record: Record<string, unknown>): Project {
  return record as unknown as Project;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asTask(record: Record<string, unknown>): Task {
  return record as unknown as Task;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asMilestone(record: Record<string, unknown>): Milestone {
  return record as unknown as Milestone;
}

/**
 * Compute project progress from task completion percentage
 * Returns the percentage but does not persist it (Project schema has no progress field)
 */
export async function computeProjectProgress(
  projectId: string,
  token?: string
): Promise<number> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Get all tasks for this project
  const results = await pb.collection('tasks').getFullList({
    filter: `project_id = "${projectId}"`,
  });
  const tasks = results.map((r) => asTask(r as unknown as Record<string, unknown>));

  if (tasks.length === 0) return 0;

  const done = tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / tasks.length) * 100);
}

/**
 * Get project with computed progress and task counts
 */
export async function getProjectWithProgress(
  projectId: string,
  token?: string
): Promise<Project & { taskCount: number; doneCount: number; progress: number }> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const project = asProject(
    await pb.collection('projects').getOne(projectId) as unknown as Record<string, unknown>
  );

  const results = await pb.collection('tasks').getFullList({
    filter: `project_id = "${projectId}"`,
  });
  const tasks = results.map((r) => asTask(r as unknown as Record<string, unknown>));

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return {
    ...project,
    taskCount: tasks.length,
    doneCount,
    progress,
  };
}

/**
 * Check milestone dependency enforcement
 */
export async function canStartMilestone(
  milestoneId: string,
  token?: string
): Promise<{ allowed: boolean; blockedBy: string[] }> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  // Get the milestone with its embedded dependencies
  const milestone = asMilestone(
    await pb.collection('milestones').getOne(milestoneId) as unknown as Record<string, unknown>
  );

  const blockedBy: string[] = [];

  for (const dep of milestone.dependencies || []) {
    const depMilestone = asMilestone(
      await pb
        .collection('milestones')
        .getOne(dep.depends_on_id) as unknown as Record<string, unknown>
    );
    if (depMilestone.status !== 'complete') {
      blockedBy.push(dep.depends_on_id);
    }
  }

  return {
    allowed: blockedBy.length === 0,
    blockedBy,
  };
}

/**
 * Get milestone timeline for a project
 */
export async function getMilestoneTimeline(
  projectId: string,
  token?: string
): Promise<Milestone[]> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const results = await pb.collection('milestones').getFullList({
    filter: `project_id = "${projectId}"`,
    sort: 'sort_order',
  });

  return results.map((r) => asMilestone(r as unknown as Record<string, unknown>));
}

/**
 * Log milestone status change to milestone_history
 */
export async function logMilestoneStatusChange(
  milestoneId: string,
  field: string,
  oldValue: string | undefined,
  newValue: string,
  changedBy?: string,
  token?: string
): Promise<void> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  await pb.collection('milestone_history').create({
    milestone_id: milestoneId,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
  });
}
