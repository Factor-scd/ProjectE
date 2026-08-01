import { createAdminClient } from '../pocketbase';
import type {
  Task,
  Habit,
  HabitLog,
  Milestone,
  TimeEntry,
} from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asTask(record: Record<string, unknown>): Task {
  return record as unknown as Task;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asHabit(record: Record<string, unknown>): Habit {
  return record as unknown as Habit;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asHabitLog(record: Record<string, unknown>): HabitLog {
  return record as unknown as HabitLog;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asMilestone(record: Record<string, unknown>): Milestone {
  return record as unknown as Milestone;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asTimeEntry(record: Record<string, unknown>): TimeEntry {
  return record as unknown as TimeEntry;
}

/**
 * Generate weekly summary report data
 */
export async function generateWeeklySummary(
  weekStart: string,
  weekEnd: string,
  token?: string
): Promise<{
  tasksCompleted: number;
  habitsTracked: number;
  timeLogged: number;
  streaks: Array<{ name: string; streak: number }>;
  byDomain: Record<string, { tasks: number; habits: number }>;
}> {
  const pb = token ? createAdminClient() : createAdminClient();

  // Tasks completed this week
  const taskResults = await pb.collection('tasks').getFullList({
    filter: `status = "done" && completed_at >= "${weekStart}" && completed_at <= "${weekEnd}"`,
  });
  const tasks = taskResults.map((r) => asTask(r as unknown as Record<string, unknown>));

  // Habits logged this week
  const habitLogResults = await pb.collection('habit_logs').getFullList({
    filter: `logged_at >= "${weekStart}" && logged_at <= "${weekEnd}"`,
  });
  const habitLogs = habitLogResults.map((r) =>
    asHabitLog(r as unknown as Record<string, unknown>)
  );

  // Time entries this week
  const timeEntryResults = await pb.collection('time_entries').getFullList({
    filter: `started_at >= "${weekStart}" && started_at <= "${weekEnd}"`,
  });
  const timeEntries = timeEntryResults.map((r) =>
    asTimeEntry(r as unknown as Record<string, unknown>)
  );

  const totalTime = timeEntries.reduce(
    (sum, e) => sum + e.duration_minutes,
    0
  );

  // Streaks
  const habitResults = await pb.collection('habits').getFullList();
  const habits = habitResults.map((r) => asHabit(r as unknown as Record<string, unknown>));
  const streaks = habits
    .map((h) => ({ name: h.name, streak: h.current_streak }))
    .sort((a, b) => b.streak - a.streak);

  // By domain
  const byDomain: Record<string, { tasks: number; habits: number }> = {};
  for (const task of tasks) {
    if (!byDomain[task.domain])
      byDomain[task.domain] = { tasks: 0, habits: 0 };
    byDomain[task.domain].tasks++;
  }

  return {
    tasksCompleted: tasks.length,
    habitsTracked: habitLogs.length,
    timeLogged: totalTime,
    streaks,
    byDomain,
  };
}

/**
 * Generate project health report data
 */
export async function generateProjectHealth(
  projectId: string,
  token?: string
): Promise<{
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  milestoneStatus: Record<string, number>;
  completionRate: number;
}> {
  const pb = token ? createAdminClient() : createAdminClient();

  const taskResults = await pb.collection('tasks').getFullList({
    filter: `project_id = "${projectId}"`,
  });
  const tasks = taskResults.map((r) => asTask(r as unknown as Record<string, unknown>));

  const today = new Date().toISOString().split('T')[0];
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && t.due_date < today && t.status !== 'done'
  ).length;

  // Milestone status
  const milestoneResults = await pb.collection('milestones').getFullList({
    filter: `project_id = "${projectId}"`,
  });
  const milestones = milestoneResults.map((r) =>
    asMilestone(r as unknown as Record<string, unknown>)
  );

  const milestoneStatus: Record<string, number> = {
    planned: 0,
    in_progress: 0,
    complete: 0,
  };
  for (const m of milestones) {
    milestoneStatus[m.status] = (milestoneStatus[m.status] || 0) + 1;
  }

  return {
    taskCount: tasks.length,
    doneCount,
    overdueCount,
    milestoneStatus,
    completionRate:
      tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0,
  };
}

/**
 * Generate habit analysis report data
 */
export async function generateHabitAnalysis(
  days: number = 30,
  token?: string
): Promise<{
  habits: Array<{
    id: string;
    name: string;
    streak: number;
    score: number;
    consistencyRate: number;
    completions: number;
  }>;
  atRiskHabits: string[];
}> {
  const pb = token ? createAdminClient() : createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  const habitResults = await pb.collection('habits').getFullList();
  const habits = habitResults.map((r) => asHabit(r as unknown as Record<string, unknown>));

  const habitAnalysis = [];
  const atRiskHabits: string[] = [];

  for (const habit of habits) {
    const logResults = await pb.collection('habit_logs').getFullList({
      filter: `habit_id = "${habit.id}" && logged_at >= "${startStr}" && completed = true && skipped = false`,
    });
    const logs = logResults.map((r) =>
      asHabitLog(r as unknown as Record<string, unknown>)
    );

    const consistencyRate = Math.round((logs.length / days) * 100);

    habitAnalysis.push({
      id: habit.id,
      name: habit.name,
      streak: habit.current_streak,
      score: habit.score,
      consistencyRate,
      completions: logs.length,
    });

    // At risk: consistency < 50% or streak broken
    if (consistencyRate < 50 || habit.current_streak === 0) {
      atRiskHabits.push(habit.name);
    }
  }

  return {
    habits: habitAnalysis.sort((a, b) => b.score - a.score),
    atRiskHabits,
  };
}

/**
 * Generate time audit report data
 */
export async function generateTimeAudit(
  startDate: string,
  endDate: string,
  token?: string
): Promise<{
  totalMinutes: number;
  byDomain: Record<string, number>;
  byProject: Record<string, number>;
  byTag: Record<string, number>;
}> {
  const pb = token ? createAdminClient() : createAdminClient();

  const entryResults = await pb.collection('time_entries').getFullList({
    filter: `started_at >= "${startDate}" && started_at <= "${endDate}"`,
  });
  const entries = entryResults.map((r) =>
    asTimeEntry(r as unknown as Record<string, unknown>)
  );

  const byDomain: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  let totalMinutes = 0;

  for (const entry of entries) {
    totalMinutes += entry.duration_minutes;

    // Get the entity to access domain/project/tags
    // TimeEntry uses entity_type and entity_id
    if (entry.entity_type === 'task') {
      const task = asTask(
        await pb
          .collection('tasks')
          .getOne(entry.entity_id) as unknown as Record<string, unknown>
      );

      byDomain[task.domain] =
        (byDomain[task.domain] || 0) + entry.duration_minutes;

      if (task.project_id) {
        byProject[task.project_id] =
          (byProject[task.project_id] || 0) + entry.duration_minutes;
      }

      for (const tag of task.tags || []) {
        byTag[tag] = (byTag[tag] || 0) + entry.duration_minutes;
      }
    }
  }

  return { totalMinutes, byDomain, byProject, byTag };
}
