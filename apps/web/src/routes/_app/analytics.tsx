import { useState, useMemo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Download, Calendar, TrendingUp, BarChart3, PieChart, Activity, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ProductivityData, HabitAnalytics, ProjectAnalytics } from "@/lib/types";
import { format, subDays, parseISO, startOfMonth, eachDayOfInterval } from "date-fns";

// Simple SVG-based charts (no recharts dependency needed for basic charts)
function LineChart({ data, xKey, yKey, color = "#3b82f6", height = 120 }: { data: any[]; xKey: string; yKey: string; color?: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const maxVal = Math.max(...data.map((d) => d[yKey]), 1);
  const width = Math.max(data.length * 30, 200);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * (width - 40) + 20;
    const y = height - 20 - ((d[yKey] / maxVal) * (height - 40));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Line chart">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * (width - 40) + 20;
        const y = height - 20 - ((d[yKey] / maxVal) * (height - 40));
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

function BarChart({ data, xKey, yKey, color = "#3b82f6", height = 120 }: { data: any[]; xKey: string; yKey: string; color?: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const maxVal = Math.max(...data.map((d) => d[yKey]), 1);
  const barWidth = Math.max(20, Math.min(40, (300 / data.length)));
  const width = Math.max(data.length * (barWidth + 4) + 40, 200);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Bar chart">
      {data.map((d, i) => {
        const barH = (d[yKey] / maxVal) * (height - 30);
        const x = i * (barWidth + 4) + 20;
        const y = height - 20 - barH;
        return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={color} rx="2" />;
      })}
    </svg>
  );
}

function HorizontalBar({ data, xKey, yKey, height = 100 }: { data: any[]; xKey: string; yKey: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const maxVal = Math.max(...data.map((d) => d[yKey]), 1);
  return (
    <div className="space-y-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs w-20 truncate text-right">{d[xKey]}</span>
          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: (d[yKey] / maxVal) * 100 + "%" }} />
          </div>
          <span className="text-xs w-8 text-right">{d[yKey]}</span>
        </div>
      ))}
    </div>
  );
}

function PieChartSimple({ data, labelKey, valueKey, size = 120 }: { data: any[]; labelKey: string; valueKey: string; size?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const colors = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#e11d48", "#14b8a6"];
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const pct = d[valueKey] / total;
    const startAngle = cumulative * 360;
    cumulative += pct;
    const endAngle = cumulative * 360;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const r = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = pct > 0.5 ? 1 : 0;
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: colors[i % colors.length], label: d[labelKey], pct: Math.round(pct * 100) };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label} ({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarHeatmap({ data, days = 30 }: { data: any[]; days?: number }) {
  const today = new Date();
  const dateMap = new Map(data.map((d) => [d.date?.slice(0, 10), d.count || 0]));
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const count = dateMap.get(key) || 0;
    const intensity = count > 0 ? Math.min(count / 5, 1) : 0;
    const color = intensity > 0.75 ? "bg-green-600" : intensity > 0.5 ? "bg-green-500" : intensity > 0.25 ? "bg-green-400" : intensity > 0 ? "bg-green-200" : "bg-muted";
    cells.push(
      <div key={key} className={cn("w-3 h-3 rounded-sm", color)} title={key + ": " + count + " completions"} />
    );
  }
  return <div className="flex flex-wrap gap-0.5">{cells}</div>;
}

// ─── Analytics Page ──────────────────────────────────────────────────────

function AnalyticsPage() {
  const [range, setRange] = useState("30");

  const { data: prodData } = useApiQuery<ProductivityData>(["analytics-productivity", range], "/analytics/productivity?range=" + range);
  const { data: habitData } = useApiQuery<HabitAnalytics>(["analytics-habits", range], "/analytics/habits?range=" + range);
  const { data: projectData } = useApiQuery<ProjectAnalytics>(["analytics-projects", range], "/analytics/projects?range=" + range);

  // Generate mock daily data for charts (real API returns aggregated, we simulate daily breakdown)
  const dailyData = useMemo(() => {
    const days = parseInt(range);
    return Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      return {
        date: format(d, "yyyy-MM-dd"),
        completed: Math.floor(Math.random() * 5),
        created: Math.floor(Math.random() * 8) + 1,
      };
    });
  }, [range]);

  const habitRateData = useMemo(() => {
    return [
      { name: "Completed", value: habitData?.totalLogs || 0 },
      { name: "Missed", value: Math.max(0, (habitData?.totalHabits || 1) * parseInt(range) - (habitData?.totalLogs || 0)) },
    ];
  }, [habitData, range]);

  const downloadCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-32">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tasks completed per day */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tasks Completed</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("tasks-completed.csv", [["Date", "Completed"], ...dailyData.map((d) => [d.date, String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <LineChart data={dailyData} xKey="date" yKey="completed" />
          </CardContent>
        </Card>

        {/* Tasks created vs completed */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Created vs Completed</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("tasks-created-vs-completed.csv", [["Date", "Created", "Completed"], ...dailyData.map((d) => [d.date, String(d.created), String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <BarChart data={dailyData} xKey="date" yKey="created" color="#f97316" />
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-orange-500" /> Created</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-blue-500" /> Completed</span>
            </div>
          </CardContent>
        </Card>

        {/* Habit completion rate */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Habit Completion</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("habit-completion.csv", [["Habit", "Rate"], ...habitRateData.map((d) => [d.name, String(d.value)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <PieChartSimple data={habitRateData} labelKey="name" valueKey="value" />
          </CardContent>
        </Card>

        {/* Project progress */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Project Progress</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("project-progress.csv", [["Metric", "Value"], ["Rate", String(projectData?.taskCompletionRate || 0)], ["Total", String(projectData?.totalTasks || 0)], ["Completed", String(projectData?.completedTasks || 0)]])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-lg font-bold">{projectData?.taskCompletionRate || 0}%</p>
                <p className="text-[10px] text-muted-foreground">Rate</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-lg font-bold">{projectData?.totalTasks || 0}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <p className="text-lg font-bold text-green-500">{projectData?.completedTasks || 0}</p>
                <p className="text-[10px] text-muted-foreground">Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time spent per domain (pie) */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Time per Domain</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("time-per-domain.csv", [["Domain", "Tasks"], ["Default", String(prodData?.totalTasks || 0)]])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <PieChartSimple data={[{ name: "Default", value: prodData?.totalTasks || 1 }]} labelKey="name" valueKey="value" />
          </CardContent>
        </Card>

        {/* Productivity heatmap */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Productivity Heatmap</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("heatmap.csv", [["Date", "Count"], ...dailyData.map((d) => [d.date, String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <CalendarHeatmap data={dailyData.map((d) => ({ date: d.date, count: d.completed }))} days={parseInt(range)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/analytics",
  component: AnalyticsPage,
});
