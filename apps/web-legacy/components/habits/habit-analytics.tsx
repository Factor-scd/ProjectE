'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp } from 'lucide-react';

interface HabitAnalyticsProps {
  domainId: string;
  habits: { id: string; name: string }[];
}

interface StreakItem {
  habitId: string;
  habitName: string;
  currentStreak: number;
  bestStreak: number;
}

interface CompletionDay {
  date: string;
  count: number;
}

export function HabitAnalytics({ domainId, habits }: HabitAnalyticsProps) {
  const [open, setOpen] = useState(false);
  const [streaks, setStreaks] = useState<StreakItem[]>([]);
  const [completions, setCompletions] = useState<CompletionDay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    Promise.all([
      fetch('/api/habits/streaks').then((r) => r.json()),
      ...habits.map((h) =>
        fetch(
          '/api/domains/' + domainId + '/habits/' + h.id + '/completions?from=' + daysAgo(30) + '&order=asc&limit=365'
        ).then((r) => r.json())
      ),
    ])
      .then(([streaksData, ...completionsData]) => {
        setStreaks((streaksData.streaks || []).slice(0, 5));

        const dateMap = new Map<string, number>();
        for (const data of completionsData) {
          for (const item of data.items || []) {
            const d = item.date?.split('T')[0];
            if (d) dateMap.set(d, (dateMap.get(d) || 0) + 1);
          }
        }
        const sorted = Array.from(dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ date, count }));
        setCompletions(sorted);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, domainId, habits]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BarChart3 className="mr-2 h-4 w-4" />
        Show analytics
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Analytics (30 days)</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                Daily Completions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={completions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                Top Streaks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {streaks.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No streaks yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={streaks} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="habitName" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="bestStreak" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
