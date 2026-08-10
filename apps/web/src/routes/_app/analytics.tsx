import { useState, useMemo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DailyAnalytics, HabitAnalytics, ProjectAnalytics } from "@/lib/types";
import { format, subDays } from "date-fns";

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

function BarChart({ data, xKey, yKey, yKey2, color = "#3b82f6", color2 = "#f97316", height = 120 }: { data: any[]; xKey: string; yKey: string; yKey2?: string; color?: string; color2?: string; height?: number }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No data</p>;
  const valOf = (d: any, key?: string) => (key ? ((d[key] as number) ?? 0) : 0);
  const maxVal = Math.max(...data.map((d) => Math.max(valOf(d, yKey), valOf(d, yKey2))), 1);
  const series = yKey2 ? 2 : 1;
  const barWidth = Math.max(20, Math.min(40, (300 / data.length) / series));
  const width = Math.max(data.length * (barWidth * series + 4) + 40, 200);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-label="Bar chart">
      {data.map((d, i) => {
        const barH = (valOf(d, yKey) / maxVal) * (height - 30);
        const x = i * (barWidth * series + 4) + 20;
        const y = height - 20 - barH;
        return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={color} rx="2" />;
      })}
      {yKey2 && data.map((d, i) => {
        const barH = (valOf(d, yKey2) / maxVal) * (height - 30);
        const x = i * (barWidth * series + 4) + 20 + barWidth;
        const y = height - 20 - barH;
        return <rect key={i} x={x} y={y} width={barWidth} height={barH} fill={color2} rx="2" />;
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
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";

  const { data: habitData, isLoading: habitsLoading, error: habitsError, refetch: refetchHabits } = useApiQuery<HabitAnalytics>(["analytics-habits", activeDomainId, range], "/analytics/habits?range=" + range + domainSuffix);
  const { data: projectData, isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } = useApiQuery<ProjectAnalytics>(["analytics-projects", activeDomainId, range], "/analytics/projects?range=" + range + domainSuffix);
  const { data: dailyData, isLoading: dailyLoading, error: dailyError, refetch: refetchDaily } = useApiQuery<DailyAnalytics>(["analytics-daily", activeDomainId, range], "/analytics/daily?range=" + range + domainSuffix);

  const analyticsLoading = habitsLoading || projectsLoading || dailyLoading;
  const analyticsError = habitsError || projectsError || dailyError;
  const refetchAnalytics = () => {
    refetchHabits();
    refetchProjects();
    refetchDaily();
  };

  const dailyItems = dailyData?.items || [];

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

      {analyticsLoading ? (
        <LoadingState label="Loading analytics..." />
      ) : analyticsError ? (
        <ErrorState message={analyticsError.message || "Failed to load analytics"} onRetry={refetchAnalytics} />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tasks completed per day */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tasks Completed</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("tasks-completed.csv", [["Date", "Completed"], ...dailyItems.map((d) => [d.date, String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <LineChart data={dailyItems} xKey="date" yKey="completed" />
          </CardContent>
        </Card>

        {/* Tasks created vs completed */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Created vs Completed</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("tasks-created-vs-completed.csv", [["Date", "Created", "Completed"], ...dailyItems.map((d) => [d.date, String(d.created), String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <BarChart data={dailyItems} xKey="date" yKey="created" yKey2="completed" color="#f97316" color2="#3b82f6" />
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
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("project-progress.csv", [["Project", "Total Tasks", "Completed", "Progress"], ...(projectData?.projects || []).map((p) => [p.name, String(p.totalTasks), String(p.completedTasks), String(Math.round(p.progress * 100)) + "%"])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            {projectData?.projects.length ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{projectData.totalProjects} project{projectData.totalProjects === 1 ? "" : "s"} · progress is % of tasks done</p>
                <HorizontalBar
                  data={projectData.projects.map((p) => ({ name: p.name, progress: Math.round(p.progress * 100) }))}
                  xKey="name"
                  yKey="progress"
                  height={Math.max(100, projectData.projects.length * 26)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No projects yet</p>
            )}
          </CardContent>
        </Card>

        {/* Tasks by project (pie) */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tasks by Project</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("tasks-by-project.csv", [["Project", "Total Tasks"], ...(projectData?.projects || []).map((p) => [p.name, String(p.totalTasks)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            {projectData?.projects.length ? (
              <PieChartSimple data={projectData.projects.map((p) => ({ name: p.name, value: p.totalTasks }))} labelKey="name" valueKey="value" />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No projects yet</p>
            )}
          </CardContent>
        </Card>

        {/* Productivity heatmap */}
        <Card>
          <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Productivity Heatmap</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => downloadCSV("heatmap.csv", [["Date", "Count"], ...dailyItems.map((d) => [d.date, String(d.completed)])])}><Download className="h-3.5 w-3.5" /></Button>
          </CardHeader>
          <CardContent className="p-4">
            <CalendarHeatmap data={dailyItems.map((d) => ({ date: d.date, count: d.completed }))} days={parseInt(range)} />
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/analytics",
  component: AnalyticsPage,
});
