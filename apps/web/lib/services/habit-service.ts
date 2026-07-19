import { createPocketBaseClient, createAdminClient } from '../pocketbase';
import type { Habit, HabitLog, HabitScoreConfig } from '@project-e/shared';

function asHabit(record: Record<string, unknown>): Habit {
  return record as unknown as Habit;
}

function asHabitLog(record: Record<string, unknown>): HabitLog {
  return record as unknown as HabitLog;
}

const DEFAULT_SCORE_CONFIG: Required<HabitScoreConfig> = {
  streak_weight: 0.5,
  consistency_weight: 0.2,
  difficulty_weight: 0.3,
};

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 0.7,
  medium: 1.0,
  hard: 1.3,
};

export function calculateHabitScore(
  habit: Habit,
  logs: HabitLog[],
  scoreConfig?: HabitScoreConfig
): number {
  const config = { ...DEFAULT_SCORE_CONFIG, ...scoreConfig };
  const streakScore = Math.min((habit.current_streak / 30) * 100, 100);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentLogs = logs.filter(
    (l) => new Date(l.logged_at) >= thirtyDaysAgo && (l as any).completed && !(l as any).skipped
  );
  const consistencyScore = (recentLogs.length / 30) * 100;
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[habit.difficulty] || 1.0;
  const difficultyScore = difficultyMultiplier * 100;
  const score = Math.round(
    streakScore * config.streak_weight +
    consistencyScore * config.consistency_weight +
    difficultyScore * config.difficulty_weight
  );
  return Math.min(Math.max(score, 0), 100);
}

export function updateStreaks(
  habit: Habit,
  completionDate: string
): { current_streak: number; best_streak: number } {
  const today = new Date(completionDate);
  const lastCompleted = habit.updated ? new Date(habit.updated) : null;
  let newStreak = habit.current_streak;
  if (lastCompleted) {
    const daysDiff = Math.floor((today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff === 1) newStreak = habit.current_streak + 1;
    else if (daysDiff === 0) newStreak = habit.current_streak;
    else newStreak = 1;
  } else {
    newStreak = 1;
  }
  return { current_streak: newStreak, best_streak: Math.max(newStreak, habit.best_streak) };
}

export async function logHabitCompletion(
  habitId: string,
  data: { logged_at?: string; mood?: number; value?: number; notes?: string },
  token?: string
): Promise<{ log: HabitLog; habit: Habit }> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();
  const loggedAt = data.logged_at || new Date().toISOString();
  const log = asHabitLog(
    await pb.collection('habit_logs').create({
      habit_id: habitId,
      mood: data.mood || undefined,
      notes: data.notes || '',
      logged_at: loggedAt,
    }) as unknown as Record<string, unknown>
  );
  const habit = asHabit(await pb.collection('habits').getOne(habitId) as unknown as Record<string, unknown>);
  const streaks = updateStreaks(habit, loggedAt);
  const allLogsResult = await pb.collection('habit_logs').getFullList({ filter: `habit_id = "${habitId}"` });
  const allLogs = allLogsResult.map((r) => asHabitLog(r as unknown as Record<string, unknown>));
  const score = calculateHabitScore(habit, allLogs, (habit as any).score_config as HabitScoreConfig);
  const updatedHabit = asHabit(
    await pb.collection('habits').update(habitId, {
      current_streak: streaks.current_streak,
      best_streak: streaks.best_streak,
      total_completions: (habit.total_completions || 0) + 1,
    }) as unknown as Record<string, unknown>
  );
  return { log, habit: updatedHabit };
}

export function isHabitDueToday(habit: Habit): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay();
  if ((habit as any).custom_days && (habit as any).custom_days.length > 0) {
    return (habit as any).custom_days.includes(dayOfWeek);
  }
  switch (habit.frequency) {
    case 'daily': return true;
    case 'weekly': {
      const startDate = (habit as any).start_date ? new Date((habit as any).start_date) : new Date(habit.created);
      return dayOfWeek === startDate.getDay();
    }
    case 'custom': return true;
    default: return true;
  }
}

export async function getHabitsDueToday(token?: string): Promise<Habit[]> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();
  const results = await pb.collection('habits').getFullList({ filter: "archived != true" });
  return results.map((r) => asHabit(r as unknown as Record<string, unknown>)).filter((habit) => isHabitDueToday(habit));
}

export async function getHabitStreaks(token?: string): Promise<Array<{ habit: Habit; current_streak: number; best_streak: number }>> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();
  const results = await pb.collection('habits').getFullList({ filter: "archived != true" });
  const habits = results.map((r) => asHabit(r as unknown as Record<string, unknown>));
  return habits
    .map((h) => ({ habit: h, current_streak: h.current_streak || 0, best_streak: h.best_streak || 0 }))
    .sort((a, b) => b.current_streak - a.current_streak);
}