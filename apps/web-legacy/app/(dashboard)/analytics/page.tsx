'use client';

import { useEffect, useState, Suspense } from 'react';
import {
  TrendingUp,
  Target,
  Clock,
  Flame,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

// Lazy load recharts (~180KB)
const AnalyticsCharts = dynamic(
  () => import('@/components/analytics/analytics-charts').then((m) => m.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-[350px] animate-pulse rounded-lg border bg-muted/30 p-6">
            <div className="mb-4 h-5 w-40 rounded bg-muted/50" />
            <div className="h-full rounded bg-muted/30" />
          </div>
        ))}
      </div>
    ),
  }
);

interface AnalyticsData {
  taskCompletionRate: number;
  habitConsistency: number;
  totalTimeMinutes: number;
  activeStreaks: number;
  bestStreak: number;
  period: number;
}

interface TimeData {
  date: string;
  tasks: number;
  habits: number;
  time: number;
}

interface DomainData {
  name: string;
  value: number;
  color: string;
}

interface HabitData {
  name: string;
  streak: number;
  score: number;
  consistency: number;
}

function countByDate(records: Array<Record<string, unknown>>, field: string) {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = record[field];
    if (typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) {
      const date = new Date(value).toISOString().slice(0, 10);
      counts[date] = (counts[date] || 0) + 1;
    }
    return counts;
  }, {});
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeData, setTimeData] = useState<TimeData[]>([]);
  const [domainData, setDomainData] = useState<DomainData[]>([]);
  const [habitData, setHabitData] = useState<HabitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
      const start = startDate.toISOString();
      const [analyticsResponse, timeResponse, habitsResponse, tasksResponse, habitLogsResponse] = await Promise.all([
        fetch('/api/analytics?period=30'),
        fetch(`/api/time-summary?start=${encodeURIComponent(start)}`),
        fetch('/api/habits/streaks'),
        fetch('/api/tasks?perPage=500'),
        fetch(`/api/habit-logs?start=${encodeURIComponent(start)}`),
      ]);

      if (![analyticsResponse, timeResponse, habitsResponse, tasksResponse, habitLogsResponse].every((response) => response.ok)) {
        throw new Error('One or more analytics sources could not be loaded.');
      }

      const [analyticsData, timeSummary, habitsData, tasksData, habitLogsData] = await Promise.all([
        analyticsResponse.json(),
        timeResponse.json(),
        habitsResponse.json(),
        tasksResponse.json(),
        habitLogsResponse.json(),
      ]);

      const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
      const domains: DomainData[] = Object.entries(timeSummary.byDomain || {}).map(([name, value], index) => ({
        name,
        value: value as number,
        color: COLORS[index % COLORS.length],
      }));
      const habits: HabitData[] = (habitsData.streaks || []).map(
        (s: { habit: { name: string; score?: number }; current_streak: number }) => ({
          name: s.habit.name,
          streak: s.current_streak,
          score: s.habit.score || 0,
          consistency: 0,
        })
      );
      const completedByDate = countByDate(tasksData.items || [], 'completed_at');
      const habitsByDate = countByDate(habitLogsData.items || [], 'logged_at');
      const minutesByDate = timeSummary.byDate || {};
      const dailyData = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          tasks: completedByDate[key] || 0,
          habits: habitsByDate[key] || 0,
          time: minutesByDate[key] || 0,
        };
      });

      setAnalytics(analyticsData);
      setDomainData(domains);
      setHabitData(habits);
      setTimeData(dailyData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError('Analytics could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading analytics...</p>;
  }

  if (error || !analytics) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground" role="alert">{error || 'Analytics are unavailable.'}</p>
        <Button onClick={fetchAnalytics}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Patterns behind your progress.</p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Task Completion
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.taskCompletionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last {analytics.period} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Habit Consistency
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.habitConsistency}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last {analytics.period} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Time Tracked</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.totalTimeMinutes / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Last {analytics.period} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Streaks
            </CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeStreaks}</div>
            <p className="text-xs text-muted-foreground">
              Best: {analytics.bestStreak} days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="time">Time</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-6">
          <Suspense
            fallback={
              <div className="grid grid-cols-1 gap-6">
                {[1, 2].map((i) => (
                  <div key={i} className="h-[350px] animate-pulse rounded-lg border bg-muted/30 p-6" />
                ))}
              </div>
            }
          >
            <AnalyticsCharts
              timeData={timeData}
              domainData={domainData}
              habitData={habitData}
              activeTab="trends"
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="habits" className="mt-6">
          <Suspense
            fallback={
              <div className="h-[350px] animate-pulse rounded-lg border bg-muted/30 p-6" />
            }
          >
            <AnalyticsCharts
              timeData={timeData}
              domainData={domainData}
              habitData={habitData}
              activeTab="habits"
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="time" className="mt-6">
          <Suspense
            fallback={
              <div className="h-[350px] animate-pulse rounded-lg border bg-muted/30 p-6" />
            }
          >
            <AnalyticsCharts
              timeData={timeData}
              domainData={domainData}
              habitData={habitData}
              activeTab="time"
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
