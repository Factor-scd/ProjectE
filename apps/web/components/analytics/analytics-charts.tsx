'use client';

import {
  TrendingUp,
  Clock,
  Flame,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const chartTooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.5rem',
};

interface AnalyticsChartsProps {
  timeData: TimeData[];
  domainData: DomainData[];
  habitData: HabitData[];
  activeTab: string;
}

export function AnalyticsCharts({
  timeData,
  domainData,
  habitData,
  activeTab,
}: AnalyticsChartsProps) {
  const hasActivity = timeData.some((day) => day.tasks > 0 || day.habits > 0 || day.time > 0);
  const hasRecentActivity = timeData.slice(-7).some((day) => day.tasks > 0 || day.habits > 0);
  const activitySummary = timeData
    .filter((day) => day.tasks > 0 || day.habits > 0 || day.time > 0)
    .map((day) => `${day.date}: ${day.tasks} tasks completed, ${day.habits} habits logged, ${day.time} minutes tracked.`)
    .join(' ');

  if (activeTab === 'trends') {
    return (
      <div className="grid grid-cols-1 gap-6">
        {/* Productivity trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
              Productivity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasActivity ? (
              <p className="py-8 text-center text-muted-foreground">No completed tasks or habit logs in the last 30 days.</p>
            ) : (
              <div role="img" aria-label={`Productivity trend. ${activitySummary}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeData} aria-hidden="true">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="tasks" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Tasks Completed" />
                    <Area type="monotone" dataKey="habits" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Habits Logged" />
                </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time tracked trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" aria-hidden="true" />
              Time Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeData.some((day) => day.time > 0) ? (
              <div role="img" aria-label={`Time tracked over the last 30 days. ${activitySummary}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeData} aria-hidden="true">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="time" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Time (minutes)" />
                </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">No time tracked in the last 30 days.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'habits') {
    return (
      <div className="grid grid-cols-1 gap-6">
        {/* Habit streaks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5" aria-hidden="true" />
              Habit Streaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {habitData.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No habits tracked
              </p>
            ) : (
              <div role="img" aria-label={`Habit streaks: ${habitData.map((habit) => `${habit.name}, ${habit.streak} days`).join('; ')}.`}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={habitData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={120}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="streak"
                    fill="#f59e0b"
                    radius={[0, 4, 4, 0]}
                    name="Current Streak (days)"
                  />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Habit scores */}
        <Card>
          <CardHeader>
            <CardTitle>Habit Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {habitData.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No habits tracked
              </p>
            ) : (
              <div className="space-y-4">
                {habitData.map((habit) => (
                  <div key={habit.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {habit.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {habit.score}/100
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${habit.score}%` }}
                        role="progressbar"
                        aria-label={`${habit.name} score`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={habit.score}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeTab === 'time') {
    return (
      <div className="grid grid-cols-1 gap-6">
        {/* Time by domain */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" aria-hidden="true" />
              Time by Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {domainData.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No time tracked
              </p>
            ) : (
              <div className="flex items-center gap-8">
                <p className="sr-only">Time by domain: {domainData.map((domain) => `${domain.name}, ${domain.value} minutes`).join('; ')}.</p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={domainData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {domainData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
              Daily Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasRecentActivity ? (
              <p className="py-8 text-center text-muted-foreground">No task or habit activity in the last 7 days.</p>
            ) : (
              <div role="img" aria-label={`Daily activity for the last 7 days. ${activitySummary}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timeData.slice(-7)}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend />
                <Bar
                  dataKey="tasks"
                  fill="#3b82f6"
                  name="Tasks"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="habits"
                  fill="#10b981"
                  name="Habits"
                  radius={[4, 4, 0, 0]}
                />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
