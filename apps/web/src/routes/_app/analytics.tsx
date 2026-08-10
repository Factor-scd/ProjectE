import { useState, useMemo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DailyAnalytics, HabitAnalytics, ProjectAnalytics } from "@/lib/types";
import { LineChart, BarChart, HorizontalBar, PieChartSimple, CalendarHeatmap } from "@/components/charts";

// ─── Analytics Page ──────────────────────────────────────────────────────

function AnalyticsPage() {
  const [range, setRange] = useState("30");
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";

  useRealtime({ enabled: true });

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
