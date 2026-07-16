import { createPocketBaseClient, createAdminClient } from '../pocketbase';
import type { Habit, HabitLog, HabitScoreConfig } from '@project-e/shared';

/** Cast a PocketBase RecordModel to a typed domain model */
function asHabit(record: Record<string, unknown>): Habit {
  return record as unknown as Habit;
}

/** Cast a PocketBase RecordModel to a typed domain model */
function asHabitLog(record: Record<string, unknown>): HabitLog {
  return record as unknown as HabitLog;
}

/**
 * Default habit score weights
 */
const DEFAULT_SCORE_CONFIG: Required<HabitScoreConfig> = {
  streak_weight: 0.5,
  consistency_weight: 0.2,
  difficulty_weight: 0.3,
};

/**
 * Difficulty multipliers
 */
const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 0.7,
  medium: 1.0,
  hard: 1.3,
};

/**
 * Calculate habit score (0-100)
 * Weighted composite: streak, consistency, difficulty
 */
export function calculateHabitScore(
  habit: Habit,
  logs: HabitLog[],
  scoreConfig?: HabitScoreConfig
): number {
  const config = { ...DEFAULT_SCORE_CONFIG, ...scoreConfig };

  // 1. Streak score (0-100)
  const streakScore = Math.min((habit.current_streak / 30) * 100, 100);

  // 2. Consistency rate (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentLogs = logs.filter(
    (l) => new Date(l.logged_at) >= thirtyDaysAgo && l.completed && !l.skipped
  );
  const consistencyScore = (recentLogs.length / 30) * 100;

  // 3. Difficulty multiplier
  const difficultyMultiplier = DIFFICULTY_MULTIPLIER[habit.difficulty] || 1.0;
  const difficultyScore = difficultyMultiplier * 100;

  // Weighted composite
  const score = Math.round(
    streakScore * config.streak_weight +
    consistencyScore * config.consistency_weight +
    difficultyScore * config.difficulty_weight
  );

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Update streaks after habit completion
 */
export function updateStreaks(
  habit: Habit,
  completionDate: string
): {
  current_streak: number;
  best_streak: number;
} {
  const today = new Date(completionDate);
  const lastCompleted = habit.updated ? new Date(habit.updated) : null;

  let newStreak = habit.current_streak;

  if (lastCompleted) {
    const daysDiff = Math.floor(
      (today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      // Consecutive day — increment streak
      newStreak = habit.current_streak + 1;
    } else if (daysDiff === 0) {
      // Same day — no change (already completed today)
      newStreak = habit.current_streak;
    } else {
      // Streak broken — reset to 1
      newStreak = 1;
    }
  } else {
    // First completion
    newStreak = 1;
  }

  return {
    current_streak: newStreak,
    best_streak: Math.max(newStreak, habit.best_streak),
  };
}

/**
 * Log habit completion
 */
export async function logHabitCompletion(
  habitId: string,
  data: {
    logged_at?: string;
    mood?: number;
    value?: number;
    notes?: string;
  },
  token?: string
): Promise<{ log: HabitLog; habit: Habit }> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const loggedAt = data.logged_at || new Date().toISOString();

  // Create log entry
  const log = asHabitLog(
    await pb.collection('habit_logs').create({
      habit_id: habitId,
      completed: true,
      mood: data.mood || undefined,
      value: data.value || undefined,
      notes: data.notes || '',
      logged_at: loggedAt,
    }) as unknown as Record<string, unknown>
  );

  // Get current habit state
  const habit = asHabit(
    await pb.collection('habits').getOne(habitId) as unknown as Record<string, unknown>
  );

  // Update streaks
  const streaks = updateStreaks(habit, loggedAt);

  // Get all logs for score calculation
  const allLogsResult = await pb.collection('habit_logs').getFullList({
    filter: `habit_id = "${habitId}"`,
  });
  const allLogs = allLogsResult.map((r) => asHabitLog(r as unknown as Record<string, unknown>));

  // Calculate new score
  const score = calculateHabitScore(
    habit,
    allLogs,
    habit.score_config as HabitScoreConfig
  );

  // Update habit
  const updatedHabit = asHabit(
    await pb.collection('habits').update(habitId, {
      current_streak: streaks.current_streak,
      best_streak: streaks.best_streak,
      total_completions: habit.total_completions + 1,
      score,
    }) as unknown as Record<string, unknown>
  );

  return { log, habit: updatedHabit };
}

/**
 * Check if a habit is due today
 */
export function isHabitDueToday(habit: Habit): boolean {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  // Check custom_days if set
  if (habit.custom_days && habit.custom_days.length > 0) {
    return habit.custom_days.includes(dayOfWeek);
  }

  // Check frequency
  switch (habit.frequency) {
    case 'daily':
      return true;
    case 'weekly': {
      // Due on the same day of week as start_date
      const startDate = habit.start_date
        ? new Date(habit.start_date)
        : new Date(habit.created);
      return dayOfWeek === startDate.getDay();
    }
    case 'custom':
      // Custom frequency without custom_days — assume always due
      return true;
    default:
      return true;
  }
}

/**
 * Get habits due today
 */
export async function getHabitsDueToday(
  token?: string
): Promise<Habit[]> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const results = await pb.collection('habits').getFullList({
    filter: 'active = true',
  });

  return results
    .map((r) => asHabit(r as unknown as Record<string, unknown>))
    .filter((habit) => isHabitDueToday(habit));
}

/**
 * Get habit streaks summary
 */
export async function getHabitStreaks(
  token?: string
): Promise<
  Array<{
    habit: Habit;
    current_streak: number;
    best_streak: number;
  }>
> {
  const pb = token ? createPocketBaseClient(token) : createAdminClient();

  const results = await pb.collection('habits').getFullList({
    filter: 'active = true',
  });

  const habits = results.map((r) => asHabit(r as unknown as Record<string, unknown>));

  return habits
    .map((h) => ({
      habit: h,
      current_streak: h.current_streak,
      best_streak: h.best_streak,
    }))
    .sort((a, b) => b.current_streak - a.current_streak);
}
