import { useState, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "../__root";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Plus, Settings2, Trash2, ListTodo, Flame, FileText, FolderKanban, Calendar, Zap, TrendingUp, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DashboardWidget, Task, Habit, Note, Project, CalendarEvent, PaginatedResponse } from "@/lib/types";
import { format, isToday, isPast, addDays, parseISO } from "date-fns";

const WIDGET_TYPES = [
  { id: "tasks_due", label: "Tasks Due Today", icon: ListTodo, defaultW: 2, defaultH: 2 },
  { id: "habits_today", label: "Habits Today", icon: Flame, defaultW: 2, defaultH: 2 },
  { id: "recent_notes", label: "Recent Notes", icon: FileText, defaultW: 2, defaultH: 2 },
  { id: "active_projects", label: "Active Projects", icon: FolderKanban, defaultW: 2, defaultH: 2 },
  { id: "upcoming_events", label: "Upcoming Events", icon: Calendar, defaultW: 2, defaultH: 2 },
  { id: "streak_counter", label: "Streak Counter", icon: Flame, defaultW: 1, defaultH: 1 },
  { id: "quick_capture", label: "Quick Capture", icon: Zap, defaultW: 2, defaultH: 1 },
  { id: "productivity_chart", label: "Productivity Chart", icon: TrendingUp, defaultW: 3, defaultH: 2 },
] as const;

function TasksDueWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<Task>>(["tasks-due", activeDomainId], "/tasks?limit=10&status=todo,in_progress&sort=due_date" + domainSuffix);
  const tasks = data?.items || [];
  const today = tasks.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
  const overdue = tasks.filter((t) => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== "done");
  return (
    <div className="space-y-2">
      {today.length === 0 && overdue.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks due today</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">Overdue ({overdue.length})</p>
              {overdue.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  <span className="truncate flex-1">{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {today.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-500 mb-1">Today ({today.length})</p>
              {today.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate flex-1">{t.title}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HabitsTodayWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<Habit>>(["habits-today", activeDomainId], "/habits?limit=20" + domainSuffix);
  const habits = data?.items || [];
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post("/habits/" + id + "/complete", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits-today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      toast.success("Habit completed");
    },
    onError: (err) => toast.error(err.message || "Failed to complete habit"),
  });
  return (
    <div className="space-y-1">
      {habits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No habits yet</p>
      ) : (
        habits.slice(0, 6).map((h) => {
          const doneToday = (h.recentCompletions || []).some((c) => {
            const d = new Date(c.date);
            const today = new Date();
            return d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
          });
          return (
            <div key={h.id} className="flex items-center gap-2 py-1">
              <button
                onClick={() => completeMutation.mutate(h.id)}
                className={cn("w-4 h-4 rounded border shrink-0 flex items-center justify-center", doneToday ? "bg-green-500 border-green-500" : "border-muted-foreground/30 hover:border-primary")}
                aria-label={doneToday ? h.name + " (completed)" : "Complete " + h.name}
              >
                {doneToday && <span className="text-[10px] text-white">\u2713</span>}
              </button>
              <span className="text-sm truncate flex-1">{h.name}</span>
              {h.streakCount > 0 && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  <Flame className="h-2.5 w-2.5 mr-0.5" />{h.streakCount}
                </Badge>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function RecentNotesWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<Note>>(["recent-notes", activeDomainId], "/notes?limit=5&sort=-updated" + domainSuffix);
  const notes = data?.items || [];
  return (
    <div className="space-y-2">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet</p>
      ) : (
        notes.map((n) => (
          <div key={n.id} className="text-sm py-1 border-b last:border-0">
            <p className="font-medium truncate">{n.title}</p>
            <p className="text-xs text-muted-foreground">{format(parseISO(n.updatedAt), "MMM d, HH:mm")}</p>
          </div>
        ))
      )}
    </div>
  );
}

function ActiveProjectsWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<Project>>(["active-projects", activeDomainId], "/projects?limit=10&status=active" + domainSuffix);
  const projects = data?.items || [];
  return (
    <div className="space-y-3">
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active projects</p>
      ) : (
        projects.slice(0, 5).map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">{p.progress || 0}%</span>
            </div>
            <Progress value={p.progress || 0} className="h-1.5" />
          </div>
        ))
      )}
    </div>
  );
}

function UpcomingEventsWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<CalendarEvent>>(["upcoming-events", activeDomainId], "/calendar/events?limit=20" + domainSuffix);
  const events = data?.items || [];
  const now = new Date();
  const weekFromNow = addDays(now, 7);
  const upcoming = events.filter((e) => {
    const start = parseISO(e.startTime);
    return start >= now && start <= weekFromNow;
  }).sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
  return (
    <div className="space-y-2">
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events</p>
      ) : (
        upcoming.slice(0, 5).map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-sm py-1">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color || "#3b82f6" }} />
            <span className="truncate flex-1">{e.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">{format(parseISO(e.startTime), "MMM d, HH:mm")}</span>
          </div>
        ))
      )}
    </div>
  );
}

function StreakCounterWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<PaginatedResponse<Habit>>(["streaks", activeDomainId], "/habits?limit=50" + domainSuffix);
  const habits = data?.items || [];
  const bestStreak = Math.max(...habits.map((h) => h.streakCount || 0), 0);
  const totalActive = habits.filter((h) => h.streakCount > 0).length;
  return (
    <div className="flex items-center gap-4 h-full">
      <div className="flex flex-col items-center">
        <Flame className="h-8 w-8 text-orange-500" />
        <span className="text-2xl font-bold">{bestStreak}</span>
        <span className="text-xs text-muted-foreground">Best streak</span>
      </div>
      <Separator orientation="vertical" />
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold">{totalActive}</span>
        <span className="text-xs text-muted-foreground">Active streaks</span>
      </div>
    </div>
  );
}

function QuickCaptureWidget() {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [text, setText] = useState("");
  const [type, setType] = useState<"task" | "note">("task");
  const createTask = useMutation({
    mutationFn: (title: string) => api.post<Task>("/tasks", { title, status: "todo", priority: "medium", ...(activeDomainId ? { domain: activeDomainId } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-due"] });
      setText("");
      toast.success("Task added");
    },
    onError: (err) => toast.error(err.message || "Failed to create task"),
  });
  const createNote = useMutation({
    mutationFn: (title: string) => api.post<Note>("/notes", { title, content: "", ...(activeDomainId ? { domain: activeDomainId } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recent-notes"] });
      setText("");
      toast.success("Note added");
    },
    onError: (err) => toast.error(err.message || "Failed to create note"),
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!text.trim()) return;
    if (type === "task") createTask.mutate(text.trim());
    else createNote.mutate(text.trim());
  };
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 flex gap-2">
        <Select value={type} onValueChange={(v) => setType(v as "task" | "note")}>
          <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="note">Note</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Quick capture..." value={text} onChange={(e) => setText(e.target.value)} className="h-9" />
      </div>
      <Button type="button" size="sm" className="h-9" disabled={!text.trim() || createTask.isPending || createNote.isPending} onClick={handleSubmit}>Add</Button>
    </form>
  );
}

function ProductivityChartWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<any>(["productivity-chart", activeDomainId], "/analytics/productivity?range=30" + domainSuffix);
  const stats = data;
  if (!stats) return <p className="text-sm text-muted-foreground">Loading...</p>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-lg font-bold">{stats.totalTasks || 0}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-lg font-bold text-green-500">{stats.completedTasks || 0}</p>
          <p className="text-[10px] text-muted-foreground">Done</p>
        </div>
        <div className="text-center p-2 bg-muted/50 rounded">
          <p className="text-lg font-bold">{stats.taskCompletionRate || 0}%</p>
          <p className="text-[10px] text-muted-foreground">Rate</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">Last {stats.period || 30} days</p>
    </div>
  );
}

function StatsWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<any>(["stats", activeDomainId], "/analytics/productivity?range=30" + domainSuffix);
  const stats = data;
  if (!stats) return <p className="text-sm text-muted-foreground">Loading...</p>;
  return (
    <div className="grid grid-cols-3 gap-3 h-full items-center">
      <div className="text-center">
        <p className="text-2xl font-bold">{stats.totalTasks || 0}</p>
        <p className="text-xs text-muted-foreground">Total Tasks</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-green-500">{stats.completedTasks || 0}</p>
        <p className="text-xs text-muted-foreground">Completed</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold">{stats.taskCompletionRate || 0}%</p>
        <p className="text-xs text-muted-foreground">Rate</p>
      </div>
    </div>
  );
}

function WidgetRenderer({ type }: { type: string }) {
  switch (type) {
    case "tasks_due": return <TasksDueWidget />;
    case "habits_today": return <HabitsTodayWidget />;
    case "recent_notes": return <RecentNotesWidget />;
    case "active_projects": return <ActiveProjectsWidget />;
    case "upcoming_events": return <UpcomingEventsWidget />;
    case "streak_counter": return <StreakCounterWidget />;
    case "quick_capture": return <QuickCaptureWidget />;
    case "productivity_chart": return <ProductivityChartWidget />;
    case "stats": return <StatsWidget />;
    default: return <p className="text-sm text-muted-foreground">Unknown widget: {type}</p>;
  }
}

function WidgetCard({ widget, onConfigure, onDelete }: { widget: DashboardWidget; onConfigure: () => void; onDelete: () => void }) {
  const typeInfo = WIDGET_TYPES.find((t) => t.id === widget.type);
  const Icon = typeInfo?.icon || Target;
  return (
    <Card
      className="h-full flex flex-col group lg:[grid-column:span_var(--w)] lg:[grid-row:span_var(--h)]"
      style={{ "--w": Math.min(widget.layout.w || 2, 4), "--h": widget.layout.h || 2 } as React.CSSProperties}
    >
      <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold truncate">{widget.title || typeInfo?.label || widget.type}</CardTitle>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onConfigure} aria-label="Configure widget"><Settings2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete} aria-label="Remove widget"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-auto">
        <WidgetRenderer type={widget.type} />
      </CardContent>
    </Card>
  );
}

function AddWidgetDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: (type: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Widget</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {WIDGET_TYPES.map((wt) => {
            const Icon = wt.icon;
            return (
              <button key={wt.id} onClick={() => { onAdd(wt.id); onOpenChange(false); }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-accent hover:border-primary transition-colors text-center">
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{wt.label}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureWidgetDialog({ widget, open, onOpenChange, onSave }: { widget: DashboardWidget | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (title: string, w: number, h: number) => void }) {
  const [title, setTitle] = useState(widget?.title || "");
  const [w, setW] = useState(widget?.layout.w || 2);
  const [h, setH] = useState(widget?.layout.h || 2);
  useEffect(() => {
    if (widget) { setTitle(widget.title || ""); setW(widget.layout.w || 2); setH(widget.layout.h || 2); }
  }, [widget]);
  const handleSave = () => { onSave(title, w, h); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Configure Widget</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="widget-title">Title</Label>
            <Input id="widget-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Widget title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="widget-w">Width (columns)</Label>
              <Select value={String(w)} onValueChange={(v) => setW(parseInt(v))}>
                <SelectTrigger id="widget-w"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 column</SelectItem>
                  <SelectItem value="2">2 columns</SelectItem>
                  <SelectItem value="3">3 columns</SelectItem>
                  <SelectItem value="4">4 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="widget-h">Height (rows)</Label>
              <Select value={String(h)} onValueChange={(v) => setH(parseInt(v))}>
                <SelectTrigger id="widget-h"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 row</SelectItem>
                  <SelectItem value="2">2 rows</SelectItem>
                  <SelectItem value="3">3 rows</SelectItem>
                  <SelectItem value="4">4 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configWidget, setConfigWidget] = useState<DashboardWidget | null>(null);
  useRealtime({ enabled: true });
  const { data: widgetsData, isLoading } = useApiQuery<{ items: DashboardWidget[]; totalItems: number }>(["dashboard-widgets"], "/dashboard/widgets");
  const widgets = widgetsData?.items || [];
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<DashboardWidget>("/dashboard/widgets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
      toast.success("Widget added");
    },
    onError: (err) => toast.error(err.message || "Failed to add widget"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<DashboardWidget>("/dashboard/widgets/" + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
      toast.success("Widget updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update widget"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/dashboard/widgets/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
      toast.success("Widget removed");
    },
    onError: (err) => toast.error(err.message || "Failed to remove widget"),
  });
  const handleAddWidget = (type: string) => {
    const typeInfo = WIDGET_TYPES.find((t) => t.id === type);
    createMutation.mutate({ type, title: typeInfo?.label || type, layout: { x: 0, y: widgets.length, w: typeInfo?.defaultW || 2, h: typeInfo?.defaultH || 2 } });
  };
  const handleConfigure = (widget: DashboardWidget) => { setConfigWidget(widget); setConfigOpen(true); };
  const handleSaveConfig = (title: string, w: number, h: number) => {
    if (!configWidget) return;
    updateMutation.mutate({ id: configWidget.id, data: { title: title || null, layout: { ...configWidget.layout, w, h } } });
  };
  const handleDelete = (id: string) => { deleteMutation.mutate(id); };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => setAddOpen(true)} aria-label="Add widget"><Plus className="h-4 w-4 mr-2" />Add Widget</Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading dashboard...</div>
      ) : widgets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Your dashboard is empty. Add some widgets to get started!</p>
          <Button onClick={() => {
            const defaults = ["tasks_due", "habits_today", "recent_notes", "active_projects", "upcoming_events", "streak_counter", "quick_capture", "productivity_chart"];
            defaults.forEach((type, i) => {
              const typeInfo = WIDGET_TYPES.find((t) => t.id === type);
              createMutation.mutate({ type, title: typeInfo?.label || type, layout: { x: 0, y: i, w: typeInfo?.defaultW || 2, h: typeInfo?.defaultH || 2 } });
            });
          }}><Plus className="h-4 w-4 mr-2" />Add Default Widgets</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 auto-rows-[minmax(120px,auto)] sm:grid-cols-2 lg:grid-cols-4">
          {widgets.map((w) => (
            <WidgetCard key={w.id} widget={w} onConfigure={() => handleConfigure(w)} onDelete={() => handleDelete(w.id)} />
          ))}
        </div>
      )}
      <AddWidgetDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAddWidget} />
      <ConfigureWidgetDialog widget={configWidget} open={configOpen} onOpenChange={setConfigOpen} onSave={handleSaveConfig} />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});
