'use client';

import { useEffect, useState } from 'react';
import CalendarHeatmap from 'react-calendar-heatmap';
import type { Habit } from '@project-e/shared';

interface HeatmapValue {
  date: Date | string;
  count: number;
}

interface HabitHeatmapProps {
  habits: Habit[];
}

export function HabitHeatmap({ habits }: HabitHeatmapProps) {
  const [values, setValues] = useState<HeatmapValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeatmapData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.length]);

  async function fetchHeatmapData() {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const response = await fetch(
        `/api/habit-logs?start=${oneYearAgo.toISOString()}`
      );
      if (response.ok) {
        const data = await response.json();
        const logs: Array<{ logged_at: string }> = data.items || [];

        // Group by date
        const byDate: Record<string, number> = {};
        logs.forEach((log) => {
          const date = new Date(log.logged_at).toISOString().split('T')[0];
          byDate[date] = (byDate[date] || 0) + 1;
        });

        const heatmapValues: HeatmapValue[] = Object.entries(byDate).map(
          ([date, count]) => ({
            date,
            count,
          })
        );

        setValues(heatmapValues);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  return (
    <div className="overflow-x-auto">
      <CalendarHeatmap
        startDate={oneYearAgo}
        endDate={today}
        values={values}
        classForValue={(value) => {
          if (!value || value.count === 0) return 'heatmap-empty';
          if (value.count <= 1) return 'heatmap-scale-1';
          if (value.count <= 2) return 'heatmap-scale-2';
          if (value.count <= 3) return 'heatmap-scale-3';
          return 'heatmap-scale-4';
        }}
        tooltipDataAttrs={(value) => {
          if (!value || value.count === 0) return null;
          const date = new Date(value.date).toLocaleDateString();
          return {
            'data-tip': `${date}: ${value.count} habit${value.count === 1 ? '' : 's'}`,
          };
        }}
        showWeekdayLabels
      />
    </div>
  );
}
