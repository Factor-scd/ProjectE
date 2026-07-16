'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Streak {
  habit: { name: string };
  streak_current: number;
}

export function HabitStreaksWidget() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreaks();
  }, []);

  async function fetchStreaks() {
    try {
      const response = await fetch('/api/habits/streaks');
      if (response.ok) {
        const data = await response.json();
        setStreaks(data.streaks || []);
      }
    } catch (error) {
      console.error('Failed to fetch streaks:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
          Top Streaks
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : streaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active streaks</p>
        ) : (
          <div className="space-y-2">
            {streaks.slice(0, 5).map((streak, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm">{streak.habit.name}</span>
                <span className="text-sm font-semibold">
                  🔥 {streak.streak_current}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
