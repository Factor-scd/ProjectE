import { useState, useEffect } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Plus, Settings2, Trash2, ListTodo, Flame, FileText, FolderKanban, Calendar, Zap, TrendingUp, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DashboardWidget, Task, Habit, Note, Project, CalendarEvent, PaginatedResponse } from "@/lib/types";
import { format, isToday, isPast, addDays, parseISO } from "date-fns";

const WIDGET_TYPES = [
  { id: "tasks_due", label: "Tasks Due Today", icon: ListTodo, defaultW: 2, defaultH: 2, accent: "text-amber-500", border: "border-l-amber-500" },
  { id: "habits_today", label: "Habits Today", icon: Flame, defaultW: 2, defaultH: 2, accent: "text-orange-500", border: "border-l-orange-500" },
  { id: "recent_notes", label: "Recent Notes", icon: FileText, defaultW: 2, defaultH: 2, accent: "text-blue-500", border: "border-l-blue-500" },
  { id: "active_projects", label: "Active Projects", icon: FolderKanban, defaultW: 2, defaultH: 2, accent: "text-purple-500", border: "border-l-purple-500" },
  { id: "upcoming_events", label: "Upcoming Events", icon: Calendar, defaultW: 2, defaultH: 2, accent: "text-sky-500", border: "border-l-sky-500" },
  { id: "streak_counter", label: "Streak Counter", icon: Flame, defaultW: 1, defaultH: 1, accent: "text-orange-500", border: "border-l-orange-500" },
  { id: "quick_capture", label: "Quick Capture", icon: Zap, defaultW: 2, defaultH: 1, accent: "text-yellow-500", border: "border-l-yellow-500" },
  { id: "productivity_chart", label: "Productivity Chart", icon: TrendingUp, defaultW: 3, defaultH: 2, accent: "text-green-500", border: "border-l-green-500" },
] as const;

function getWidgetAccent(type: string) {
  const found = WIDGET_TYPES.find((t) => t.id === type);
  return found?.accent || "text-muted-foreground";
}

function getWidgetBorder(type: string) {
  const found = WIDGET_TYPES.find((t) => t.id === type);
  return found?.border || "border-l-muted-foreground";
}

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
        <p className="text-xs text-muted-foreground">No tasks due today</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Overdue ({overdue.length})</p>
              {overdue.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  <span className="truncate flex-1">{t.title}</span>
                </div>
              ))}
            </div>
          )}
          {today.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Today ({today.length})</p>
              {today.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs py-0.5">
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
        <p className="text-xs text-muted-foreground">No habits yet</p>
      ) : (
        habits.slice(0, 6).map((h) => {
          const doneToday = (h.recentCompletions || []).some((c) => {
            const d = new Date(c.date);
            const today = new Date();
            return d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() === today.getUTCDate();
          });
          return (
            <div key={h.id} className="flex items-center gap-2 py-0.5">
              <button
                onClick={() => completeMutation.mutate(h.id)}
                className={cn("w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center", doneToday ? "bg-green-500 border-green-500" : "border-muted-foreground/30 hover:border-primary")}
                aria-label={doneToday ? h.name + " (completed)" : "Complete " + h.name}
              >
                {doneToday && <span className="text-[8px] text-white">\u2713</span>}
              </button>
              <span className="text-xs truncate flex-1">{h.name}</span>
              {h.streakCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                  <Flame className="h-2.5 w-2.5 text-orange-400" />{h.streakCount}
                </span>
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
        <p className="text-xs text-muted-foreground">No notes yet</p>
      ) : (
        notes.map((n) => (
          <div key={n.id} className="text-xs py-1.5 border-b border-border/40 last:border-0">
            <p className="font-medium truncate">{n.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(n.updatedAt), "MMM d, HH:mm")}</p>
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
        <p className="text-xs text-muted-foreground">No active projects</p>
      ) : (
        projects.slice(0, 5).map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate flex-1 font-medium">{p.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">{p.progress || 0}%</span>
            </div>
            <Progress value={p.progress || 0} className="h-1.5 bg-muted/50" />
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
        <p className="text-xs text-muted-foreground">No upcoming events</p>
      ) : (
        upcoming.slice(0, 5).map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-xs py-0.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.color || "#3b82f6" }} />
            <span className="truncate flex-1">{e.title}</span>
            <span className="text-[10px] text-muted-foreground shrink-0">{format(parseISO(e.startTime), "MMM d, HH:mm")}</span>
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
    <div className="flex items-center justify-center gap-6 h-full">
      <div className="flex flex-col items-center gap-0.5">
        <Flame className="h-5 w-5 text-orange-500" />
        <span className="text-lg font-mono font-semibold">{bestStreak}</span>
        <span className="text-[10px] text-muted-foreground">Best streak</span>
      </div>
      <Separator orientation="vertical" className="h-8" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-lg font-mono font-semibold">{totalActive}</span>
        <span className="text-[10px] text-muted-foreground">Active</span>
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Select value={type} onValueChange={(v) => setType(v as "task" | "note")}>
        <SelectTrigger className="w-[72px] h-8 text-xs shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="task">Task</SelectItem>
          <SelectItem value="note">Note</SelectItem>
        </SelectContent>
      </Select>
      <Input placeholder="Quick capture..." value={text} onChange={(e) => setText(e.target.value)} className="h-8 flex-1 font-mono text-xs" />
      <Button type="button" size="sm" className="h-8 px-3 text-xs shrink-0" disabled={!text.trim() || createTask.isPending || createNote.isPending} onClick={handleSubmit}>Add</Button>
    </form>
  );
}

function ProductivityChartWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<any>(["productivity-chart", activeDomainId], "/analytics/productivity?range=30" + domainSuffix);
  const stats = data;
  if (!stats) return <p className="text-xs text-muted-foreground">Loading...</p>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-muted/30 rounded-md">
          <p className="text-base font-mono font-semibold">{stats.totalTasks || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
        </div>
        <div className="text-center p-2 bg-muted/30 rounded-md">
          <p className="text-base font-mono font-semibold text-green-500">{stats.completedTasks || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Done</p>
        </div>
        <div className="text-center p-2 bg-muted/30 rounded-md">
          <p className="text-base font-mono font-semibold">{stats.taskCompletionRate || 0}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rate</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Last {stats.period || 30} days</p>
    </div>
  );
}

function StatsWidget() {
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const { data } = useApiQuery<any>(["stats", activeDomainId], "/analytics/productivity?range=30" + domainSuffix);
  const stats = data;
  if (!stats) return <p className="text-xs text-muted-foreground">Loading...</p>;
  return (
    <div className="grid grid-cols-3 gap-2 h-full items-center">
      <div className="text-center">
        <p className="text-xl font-mono font-semibold">{stats.totalTasks || 0}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Total Tasks</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-mono font-semibold text-green-500">{stats.completedTasks || 0}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Completed</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-mono font-semibold">{stats.taskCompletionRate || 0}%</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Rate</p>
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
    default: return <p className="text-xs text-muted-foreground">Unknown widget: {type}</p>;
  }
}

function WidgetCard({ widget, onConfigure, onDelete }: { widget: DashboardWidget; onConfigure: () => void; onDelete: () => void }) {
  const typeInfo = WIDGET_TYPES.find((t) => t.id === widget.type);
  const Icon = typeInfo?.icon || Target;
  return (
    <div
      className={cn(
        "min-h-0 h-full flex flex-col group border border-border/60 rounded-lg border-l-[3px] bg-card transition-shadow hover:shadow-md hover:shadow-black/5 lg:[grid-column:span_var(--w)] lg:[grid-row:span_var(--h)]",
        getWidgetBorder(widget.type)
      )}
      style={{ "--w": Math.min(widget.layout.w || 2, 4), "--h": widget.layout.h || 2 } as React.CSSProperties}
    >
      <div className="px-3 pt-2.5 pb-1 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", getWidgetAccent(widget.type))} />
          <span className="text-xs font-semibold truncate">{widget.title || typeInfo?.label || widget.type}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onConfigure} aria-label="Configure widget"><Settings2 className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onDelete} aria-label="Remove widget"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <div className="px-3 pb-3 pt-1 flex-1 overflow-hidden">
        <WidgetRenderer type={widget.type} />
      </div>
    </div>
  );
}

function AddWidgetDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: (type: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add Widget</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {WIDGET_TYPES.map((wt) => {
            const Icon = wt.icon;
            return (
              <button key={wt.id} onClick={() => { onAdd(wt.id); onOpenChange(false); }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/60 hover:bg-accent hover:border-primary/40 transition-colors text-center">
                <Icon className={cn("h-5 w-5", wt.accent)} />
                <span className="text-[10px] font-medium leading-tight">{wt.label}</span>
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
        <DialogHeader><DialogTitle className="text-sm">Configure Widget</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="widget-title" className="text-xs">Title</Label>
            <Input id="widget-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Widget title" className="h-8 text-xs mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="widget-w" className="text-xs">Width (columns)</Label>
              <Select value={String(w)} onValueChange={(v) => setW(parseInt(v))}>
                <SelectTrigger id="widget-w" className="h-8 text-xs mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 column</SelectItem>
                  <SelectItem value="2">2 columns</SelectItem>
                  <SelectItem value="3">3 columns</SelectItem>
                  <SelectItem value="4">4 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="widget-h" className="text-xs">Height (rows)</Label>
              <Select value={String(h)} onValueChange={(v) => setH(parseInt(v))}>
                <SelectTrigger id="widget-h" className="h-8 text-xs mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 row</SelectItem>
                  <SelectItem value="2">2 rows</SelectItem>
                  <SelectItem value="3">3 rows</SelectItem>
                  <SelectItem value="4">4 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
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
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Button onClick={() => setAddOpen(true)} size="sm" aria-label="Add widget"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Widget</Button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">Loading dashboard...</div>
      ) : widgets.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed border-border/60">
          <Zap className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground mb-3">Your dashboard is empty. Add some widgets to get started.</p>
          <Button size="sm" onClick={() => {
            const defaults = ["tasks_due", "habits_today", "recent_notes", "active_projects", "upcoming_events", "streak_counter", "quick_capture", "productivity_chart"];
            defaults.forEach((type, i) => {
              const typeInfo = WIDGET_TYPES.find((t) => t.id === type);
              createMutation.mutate({ type, title: typeInfo?.label || type, layout: { x: 0, y: i, w: typeInfo?.defaultW || 2, h: typeInfo?.defaultH || 2 } });
            });
          }}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Default Widgets</Button>
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
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
});
