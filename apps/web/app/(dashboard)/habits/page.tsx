'use client';

import { useEffect, useState, Suspense } from 'react';
import { Flame, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HabitCard } from '@/components/habits/habit-card';
import { HabitCompletionDialog } from '@/components/habits/habit-completion-dialog';
import type { Habit } from '@project-e/shared';

// Lazy load react-calendar-heatmap (~15KB)
const HabitHeatmap = dynamic(
  () => import('@/components/habits/habit-heatmap').then((m) => m.HabitHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[150px] animate-pulse rounded-lg bg-muted/30" />
    ),
  }
);

/** Extended habit with server-computed fields */
interface HabitWithMeta extends Habit {
  logged_today: boolean;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHabit, setSelectedHabit] = useState<HabitWithMeta | null>(null);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  useEffect(() => {
    fetchHabits();
  }, []);

  async function fetchHabits() {
    try {
      const response = await fetch('/api/habits');
      if (response.ok) {
        const data = await response.json();
        setHabits(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch habits:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleComplete(habit: HabitWithMeta) {
    if (habit.completion_mode === 'quick') {
      logHabitCompletion(habit.id, {});
    } else {
      setSelectedHabit(habit);
      setCompletionDialogOpen(true);
    }
  }

  async function logHabitCompletion(
    habitId: string,
    data: { mood?: number; value?: number; notes?: string }
  ) {
    try {
      await fetch(`/api/habits/${habitId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      fetchHabits();
      setCompletionDialogOpen(false);
    } catch (error) {
      console.error('Failed to log habit:', error);
    }
  }

  const completedCount = habits.filter((h) => h.logged_today).length;
  const completionRate =
    habits.length > 0 ? Math.round((completedCount / habits.length) * 100) : 0;

  if (loading) {
    return <p className="text-muted-foreground">Loading habits...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="mt-1 text-muted-foreground">
            Small actions, visible momentum.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New habit
        </Button>
      </div>

      {/* Summary banner */}
      <Card className="mb-6">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm text-muted-foreground">Today&apos;s progress</p>
            <p className="text-2xl font-bold">
              {completedCount} / {habits.length} habits
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Completion rate</p>
            <p className="text-2xl font-bold">{completionRate}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Habit cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            onComplete={() => handleComplete(habit)}
          />
        ))}
      </div>

      {/* Heatmap section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" aria-hidden="true" />
            Consistency Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={
              <div className="h-[150px] animate-pulse rounded-lg bg-muted/30" />
            }
          >
            <HabitHeatmap habits={habits} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Completion dialog */}
      {selectedHabit && (
        <HabitCompletionDialog
          habit={selectedHabit}
          open={completionDialogOpen}
          onOpenChange={setCompletionDialogOpen}
          onSubmit={(data) => logHabitCompletion(selectedHabit.id, data)}
        />
      )}
    </div>
  );
}
