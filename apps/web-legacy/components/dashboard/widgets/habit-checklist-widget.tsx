'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface Habit {
  id: string;
  name: string;
  current_streak: number;
  logged_today: boolean;
}

export function HabitChecklistWidget() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function toggleHabit(id: string) {
    try {
      await fetch(`/api/habits/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      fetchHabits();
    } catch (error) {
      console.error('Failed to log habit:', error);
    }
  }

  const completedCount = habits.filter((h) => h.logged_today).length;

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
            Habits
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{habits.length} done
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No habits tracked</p>
        ) : (
          <div className="space-y-2">
            {habits.slice(0, 5).map((habit) => (
              <div key={habit.id} className="flex items-center gap-2">
                <Checkbox
                  id={habit.id}
                  checked={habit.logged_today}
                  onCheckedChange={() => toggleHabit(habit.id)}
                  aria-label={`Mark "${habit.name}" as ${habit.logged_today ? 'incomplete' : 'complete'}`}
                />
                <label
                  htmlFor={habit.id}
                  className="flex-1 text-sm cursor-pointer"
                >
                  {habit.name}
                </label>
                {habit.current_streak > 0 && (
                  <span className="text-xs text-muted-foreground">
                    🔥 {habit.current_streak}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
