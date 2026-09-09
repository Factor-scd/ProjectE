import { useState, useMemo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { BarChart3, Download, Calendar, ListTodo, Flame, FileText, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState, ErrorState } from "@/components/state";
import { cn } from "@/lib/utils";
import type { DailyAnalytics, HabitAnalytics, ProjectAnalytics } from "@/lib/types";
import { LineChart, BarChart, HorizontalBar, PieChartSimple } from "@/components/charts";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
          <Icon className={cn("h-4.5 w-4.5", color)} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-mono font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsPage() {
  const [range, setRange] = useState("30");
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";

  useRealtime({ enabled: true });

  const { data: habitData, isLoading: habitsLoading, error: habitsError, refetch: refetchHabits } =
    useApiQuery<HabitAnalytics>(
      ["analytics-habits", activeDomainId, range],
      "/analytics/habits?range=" + range + domainSuffix,
    );

  const { data: projectData, isLoading: projectsLoading, error: projectsError, refetch: refetchProjects } =
    useApiQuery<ProjectAnalytics>(
      ["analytics-projects", activeDomainId, range],
      "/analytics/projects?range=" + range + domainSuffix,
    );

  const { data: dailyData, isLoading: dailyLoading, error: dailyError, refetch: refetchDaily } =
    useApiQuery<DailyAnalytics>(
      ["analytics-daily", activeDomainId, range],
      "/analytics/daily?range=" + range + domainSuffix,
    );

  const { data: velocityData } = useApiQuery<{ items: Array<{ date: string; completed: number }>; avg: number }>(
    ["analytics-velocity", activeDomainId, range],
    "/analytics/velocity?range=" + range + domainSuffix,
  );

  const analyticsLoading = habitsLoading || projectsLoading || dailyLoading;
  const analyticsError = habitsError || projectsError || dailyError;

  const refetchAnalytics = () => {
    refetchHabits();
    refetchProjects();
    refetchDaily();
  };

  const dailyItems = dailyData?.items || [];

  // ─── Derived stats ────────────────────────────────────────────────────
  const tasksCompleted = useMemo(
    () => dailyItems.reduce((sum, d) => sum + d.completed, 0),
    [dailyItems],
  );

  const activeStreaks = habitData?.activeStreaks ?? 0;
  const bestStreak = habitData?.bestStreak ?? 0;
  const totalProjects = projectData?.totalProjects ?? 0;

  // Notes count: use dailyAnalytics created tasks as a proxy, or 0 if unavailable.
  // The notes API doesn't have a dedicated analytics endpoint, so we estimate from the daily data.
  const notesWritten = useMemo(() => dailyItems.reduce((sum, d) => sum + d.created, 0), [dailyItems]);

  // ─── Habit pie data ───────────────────────────────────────────────────
  const habitRateData = useMemo(() => {
    const expected = (habitData as any)?.totalExpected ?? (habitData?.totalHabits || 0) * parseInt(range);
    return [
      { name: "Completed", value: habitData?.totalLogs || 0 },
      { name: "Missed", value: Math.max(0, expected - (habitData?.totalLogs || 0)) },
    ];
  }, [habitData, range]);

  // ─── CSV export ───────────────────────────────────────────────────────
  const downloadCSV = (filename: string, rows: string[][]) => {
    const csv = rows
      .map((r) =>
        r
          .map((c) => '"' + c.replace(/"/g, '""') + '"')
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label || range + " days";

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" /> Reports
        </h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {analyticsLoading ? (
        <LoadingState label="Loading reports..." />
      ) : analyticsError ? (
        <ErrorState message={analyticsError.message || "Failed to load reports"} onRetry={refetchAnalytics} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Tasks Completed"
              value={tasksCompleted}
              icon={ListTodo}
              color="text-blue-500"
              bg="bg-blue-500/10"
            />
            <StatCard
              label="Active Streaks"
              value={activeStreaks}
              icon={Flame}
              color="text-green-500"
              bg="bg-green-500/10"
            />
            <StatCard
              label="Tasks Created"
              value={notesWritten}
              icon={FileText}
              color="text-amber-500"
              bg="bg-amber-500/10"
            />
            <StatCard
              label="Active Projects"
              value={totalProjects}
              icon={FolderKanban}
              color="text-purple-500"
              bg="bg-purple-500/10"
            />
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Task velocity line chart */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Task Velocity</CardTitle>
                <div className="flex items-center gap-2">
                  {velocityData?.avg !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">
                      avg <span className="font-semibold">{velocityData.avg}</span>/day
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      downloadCSV("task-velocity.csv", [
                        ["Date", "Completed"],
                        ...(velocityData?.items || []).map((d) => [d.date, String(d.completed)]),
                      ])
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {velocityData?.items && velocityData.items.length > 0 ? (
                  <LineChart data={velocityData.items} xKey="date" yKey="completed" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data for this range</p>
                )}
              </CardContent>
            </Card>

            {/* Habit completion pie chart */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Habit Completion</CardTitle>
                <div className="flex items-center gap-2">
                  {habitData && (
                    <span className="text-xs text-muted-foreground font-mono">
                      <span className="font-semibold">{habitData.habitConsistency}%</span> rate
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      downloadCSV("habit-completion.csv", [
                        ["Status", "Count"],
                        ...habitRateData.map((d) => [d.name, String(d.value)]),
                      ])
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                {habitData && (habitData.totalLogs > 0 || habitRateData.some((d) => d.value > 0)) ? (
                  <PieChartSimple data={habitRateData} labelKey="name" valueKey="value" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No habit data</p>
                )}
              </CardContent>
            </Card>

            {/* Project distribution horizontal bar */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Project Progress</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    downloadCSV("project-progress.csv", [
                      ["Project", "Total Tasks", "Completed", "Progress"],
                      ...(projectData?.projects || []).map((p) => [
                        p.name,
                        String(p.totalTasks),
                        String(p.completedTasks),
                        Math.round(p.progress * 100) + "%",
                      ]),
                    ])
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-3">
                {projectData?.projects && projectData.projects.length > 0 ? (
                  <HorizontalBar
                    data={projectData.projects.map((p) => ({
                      name: p.name,
                      progress: Math.round(p.progress * 100),
                    }))}
                    xKey="name"
                    yKey="progress"
                    height={Math.max(100, projectData.projects.length * 26)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No projects yet</p>
                )}
              </CardContent>
            </Card>

            {/* Created vs completed bar chart */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Created vs Completed</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    downloadCSV("tasks-created-vs-completed.csv", [
                      ["Date", "Created", "Completed"],
                      ...dailyItems.map((d) => [d.date, String(d.created), String(d.completed)]),
                    ])
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-3">
                {dailyItems.length > 0 ? (
                  <>
                    <BarChart
                      data={dailyItems}
                      xKey="date"
                      yKey="created"
                      yKey2="completed"
                      color="#f97316"
                      color2="#3b82f6"
                    />
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded bg-orange-500" /> Created
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded bg-blue-500" /> Completed
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No data</p>
                )}
              </CardContent>
            </Card>

            {/* Tasks by project pie */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Tasks by Project</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    downloadCSV("tasks-by-project.csv", [
                      ["Project", "Total Tasks"],
                      ...(projectData?.projects || []).map((p) => [p.name, String(p.totalTasks)]),
                    ])
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-3">
                {projectData?.projects && projectData.projects.length > 0 ? (
                  <PieChartSimple
                    data={projectData.projects.map((p) => ({ name: p.name, value: p.totalTasks }))}
                    labelKey="name"
                    valueKey="value"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No projects yet</p>
                )}
              </CardContent>
            </Card>

            {/* Best streak highlight */}
            <Card className="border rounded-lg hover:bg-muted/20 transition-colors">
              <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Streak Records</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                    <p className="text-xl font-mono font-bold">{bestStreak}</p>
                    <p className="text-[10px] text-muted-foreground">Best streak</p>
                  </div>
                  <div className="text-center p-3 bg-muted/30 rounded-lg">
                    <Flame className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-xl font-mono font-bold">{activeStreaks}</p>
                    <p className="text-[10px] text-muted-foreground">Active streaks</p>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-muted-foreground font-mono">
                    {habitData?.totalHabits || 0} habit{(habitData?.totalHabits || 0) === 1 ? "" : "s"} tracked · {habitData?.totalLogs || 0} completions in range
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/reports",
  component: ReportsPage,
});
