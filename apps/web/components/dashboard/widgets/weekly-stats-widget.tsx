'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface WeeklyStats {
  taskCompletionRate: number;
  habitConsistency: number;
  totalTimeMinutes: number;
}

export function WeeklyStatsWidget() {
  const [stats, setStats] = useState<WeeklyStats>({
    taskCompletionRate: 0,
    habitConsistency: 0,
    totalTimeMinutes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/analytics?period=7');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          This Week
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Task completion
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">
                  {stats.taskCompletionRate}%
                </span>
                <TrendingUp className="h-3 w-3 text-green-600" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Habit consistency
              </span>
              <span className="text-sm font-semibold">
                {stats.habitConsistency}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Time tracked
              </span>
              <span className="text-sm font-semibold">
                {Math.round(stats.totalTimeMinutes / 60)}h
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
