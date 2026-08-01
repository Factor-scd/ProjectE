'use client';

import { useState, useEffect } from 'react';

interface Completion {
  id: string;
  date: string;
  value: number;
  mood: number | null;
  notes: string | null;
}

interface HabitCalendarHeatmapProps {
  habitId: string;
  domainId: string;
}

export function HabitCalendarHeatmap({ habitId, domainId }: HabitCalendarHeatmapProps) {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompletions = async () => {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 365);

        const res = await fetch(
          `/api/domains/${domainId}/habits/${habitId}/completions?from=${from.toISOString()}&to=${to.toISOString()}&limit=400`
        );
        const data = await res.json();
        setCompletions(data.items || []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchCompletions();
  }, [habitId, domainId]);

  if (loading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading heatmap...</div>;
  }

  // Build a map of date -> completion
  const completionMap = new Map<string, Completion>();
  for (const c of completions) {
    const dateKey = new Date(c.date).toISOString().split('T')[0];
    completionMap.set(dateKey, c);
  }

  // Generate last 365 days
  const today = new Date();
  const days: { date: Date; dateStr: string; completion?: Completion }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({ date: d, dateStr, completion: completionMap.get(dateStr) });
  }

  // Group by weeks (columns)
  const weeks: typeof days[] = [];
  let currentWeek: typeof days = [];
  for (const day of days) {
    currentWeek.push(day);
    if (day.date.getDay() === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const getIntensity = (completion?: Completion): string => {
    if (!completion) return 'bg-muted';
    const v = completion.value || 1;
    if (v >= 4) return 'bg-green-600';
    if (v >= 3) return 'bg-green-500';
    if (v >= 2) return 'bg-green-400';
    return 'bg-green-300';
  };

  const getTooltip = (day: typeof days[0]): string => {
    if (!day.completion) {
      return day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' — No entry';
    }
    const parts = [
      day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      `Value: ${day.completion.value}`,
    ];
    if (day.completion.mood) parts.push(`Mood: ${day.completion.mood}/5`);
    if (day.completion.notes) parts.push(`Notes: ${day.completion.notes}`);
    return parts.join(' | ');
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.dateStr}
                className={`h-3 w-3 rounded-sm ${getIntensity(day.completion)}`}
                title={getTooltip(day)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="h-3 w-3 rounded-sm bg-muted" />
          <div className="h-3 w-3 rounded-sm bg-green-300" />
          <div className="h-3 w-3 rounded-sm bg-green-400" />
          <div className="h-3 w-3 rounded-sm bg-green-500" />
          <div className="h-3 w-3 rounded-sm bg-green-600" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
