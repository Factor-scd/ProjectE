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

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeData, setTimeData] = useState<TimeData[]>([]);
  const [domainData, setDomainData] = useState<DomainData[]>([]);
  const [habitData, setHabitData] = useState<HabitData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      // Fetch overall analytics
      const analyticsResponse = await fetch('/api/analytics?period=30');
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData);
      }

      // Fetch time summary
      const timeResponse = await fetch('/api/time-summary?period=30');
      if (timeResponse.ok) {
        const timeSummary = await timeResponse.json();

        // Transform to domain data for pie chart
        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        const domains: DomainData[] = Object.entries(
          timeSummary.byDomain || {}
        ).map(([name, value], index) => ({
          name,
          value: value as number,
          color: COLORS[index % COLORS.length],
        }));
        setDomainData(domains);
      }

      // Fetch habit streaks
      const habitsResponse = await fetch('/api/habits/streaks');
      if (habitsResponse.ok) {
        const habitsData = await habitsResponse.json();
        const habits: HabitData[] = (habitsData.streaks || []).map(
          (s: {
            habit: { name: string; score?: number };
            current_streak: number;
            best_streak: number;
          }) => ({
            name: s.habit.name,
            streak: s.current_streak,
            score: s.habit.score || 0,
            consistency: 0, // Would need to calculate from logs
          })
        );
        setHabitData(habits);
      }

      // Generate sample time data (would come from API in production)
      const sampleTimeData: TimeData[] = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return {
          date: date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          tasks: Math.floor(Math.random() * 10) + 2,
          habits: Math.floor(Math.random() * 5) + 1,
          time: Math.floor(Math.random() * 180) + 30,
        };
      });
      setTimeData(sampleTimeData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !analytics) {
    return <p className="text-muted-foreground">Loading analytics...</p>;
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
