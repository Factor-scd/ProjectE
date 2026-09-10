import { useState, useCallback, useMemo, useEffect } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Pencil, Trash2, Calendar, ListTodo, Layout as LayoutIcon, MoreHorizontal, Bookmark, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { CustomFieldInputs } from "@/components/custom-fields/custom-field-inputs";
import { PRIORITY } from "@/lib/status-colors";
import type { Task, State, PaginatedResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseTaskInput } from "@/lib/nlp";
import { useSavedViewsStore } from "@/lib/stores/use-saved-views-store";
import { RecurrencePicker } from "@/components/tasks/recurrence-picker";
import { BulkActionBar } from "@/components/tasks/bulk-action-bar";
import { FilterBar, type DueFilter } from "@/components/filters/filter-bar";
import { QuickAddBar } from "@/components/tasks/quick-add-bar";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { showUndoToast } from "@/lib/undo/use-undo-toast";
import { format, parseISO, startOfDay, endOfDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from "date-fns";

/** Fallback columns when no project is selected (group by task status). */
const FALLBACK_COLUMNS: { id: string; label: string; colorClass: string; statuses: string[] }[] = [
  { id: "todo", label: "Todo", colorClass: "bg-slate-400", statuses: ["todo"] },
  { id: "in_progress", label: "In Progress", colorClass: "bg-blue-500", statuses: ["in_progress"] },
  { id: "done", label: "Done", colorClass: "bg-green-500", statuses: ["done"] },
  { id: "cancelled", label: "Cancelled", colorClass: "bg-red-500", statuses: ["cancelled"] },
];

function SortableTaskCard({ task, stateName, stateColor, projectName, onClick, onEdit }: { task: Task; stateName?: string; stateColor?: string | null; projectName?: string; onClick: () => void; onEdit?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const overdue = task.dueDate && !task.completedAt && new Date(task.dueDate) < new Date();

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-pointer rounded-lg border border-[#d9dee7] bg-white transition-colors hover:bg-[#f7f8fa]" onClick={onClick}>
        <CardContent className="p-2.5">
          <div className="flex items-start gap-2">
            <GripVertical className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{task.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {stateName && (
                  <Badge variant="secondary" className="gap-1 font-mono text-[10px]" style={stateColor ? { backgroundColor: stateColor + "20", color: stateColor } : undefined}>
                    <span className="h-1.5 w-1.5 rounded-full" style={stateColor ? { backgroundColor: stateColor } : undefined} />
                    {stateName}
                  </Badge>
                )}
                {task.dueDate && (
                  <Badge variant="outline" className={cn("font-mono text-[10px]", overdue && "border-[#ffccc7] bg-[#fff2f0] text-[#820014]")}>
                    <Calendar className="mr-1 h-3 w-3" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
                <Badge variant="secondary" className={cn("font-mono text-[10px]", PRIORITY[task.priority]?.badge)}>
                  {PRIORITY[task.priority]?.label ?? task.priority}
                </Badge>
                {task.tags?.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="font-mono text-[10px]" style={{ borderColor: tag.color || undefined }}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
              {projectName && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{projectName}</p>
              )}
            </div>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="-mr-1 -mt-1 h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label={"Edit " + task.title}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnDroppable({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-2 ring-primary/40 bg-primary/10")}>
      {children}
    </div>
  );
}

function TaskForm({ task, onClose, projectId }: { task?: Task; onClose: () => void; projectId?: string | null }) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [recurrenceRule, setRecurrenceRule] = useState(task?.recurrenceRule || "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(() => ({ ...(task?.customFields ?? {}) }));
  const parsed = !task ? parseTaskInput(title) : null;

  const effectiveProjectId = task?.projectId || projectId;

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", effectiveProjectId || ""],
    "/states?projectId=" + effectiveProjectId,
    { enabled: !!effectiveProjectId }
  );
  const projectStates = statesData?.items || [];

  const [selectedStateId, setSelectedStateId] = useState(task?.stateId || "");

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<Task>("/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch<Task>("/tasks/" + task!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    let finalTitle = title.trim();
    let finalDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    let finalPriority = priority;
    let tagNames: string[] = [];
    if (!task) {
      const p = parseTaskInput(title);
      finalTitle = p.title;
      if (p.dueDate && !dueDate) finalDueDate = p.dueDate;
      if (p.priority) finalPriority = p.priority;
      tagNames = p.tags;
    }
    const data: any = { title: finalTitle, description: description || null, priority: finalPriority, tagNames };
    if (selectedStateId) data.stateId = selectedStateId || null;
    if (finalDueDate) data.dueDate = finalDueDate;
    if (recurrenceRule) data.recurrenceRule = recurrenceRule;
    const customFields = { ...customFieldValues };
    if (Object.keys(customFields).length > 0) data.customFields = customFields;
    if (projectId && !task) data.projectId = projectId;
    if (task) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate({ ...data, ...(activeDomainId ? { domain: activeDomainId } : {}) });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="title">Title <span className="text-xs text-muted-foreground">— try "Buy milk tomorrow 5pm #groceries p1"</span></Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. Report due tomorrow 5pm #work p1' required />
        {parsed && (parsed.dueDate || parsed.priority || parsed.tags.length > 0) && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {parsed.dueDate && <Badge variant="outline" className="border-[#91caff] bg-[#e6f4ff] text-[10px] text-[#002c8c]">Due {new Date(parsed.dueDate).toLocaleDateString()} {new Date(parsed.dueDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Badge>}
            {parsed.priority && <Badge variant="secondary" className="text-[10px]">Priority {parsed.priority}</Badge>}
            {parsed.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>)}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {projectStates.length > 0 && (
          <div>
            <Label htmlFor="state">State</Label>
            <Select value={selectedStateId} onValueChange={setSelectedStateId}>
              <SelectTrigger id="state"><SelectValue placeholder="No state" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">No state</SelectItem>
                {projectStates.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || "#94a3b8" }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high" | "urgent")}>
            <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="dueDate">Due Date</Label>
        <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <RecurrencePicker value={recurrenceRule || null} onChange={(v) => setRecurrenceRule(v || "")} />
      <CustomFieldInputs entityType="tasks" values={customFieldValues} onChange={setCustomFieldValues} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {task ? "Update" : "Create"} Task
        </Button>
      </div>
    </form>
  );
}

function applyDueFilter(tasks: Task[], dueFilter: DueFilter): Task[] {
  if (dueFilter === "all") return tasks;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));
  return tasks.filter((t) => {
    if (dueFilter === "none") return !t.dueDate;
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    if (dueFilter === "overdue") return d < now && !t.completedAt;
    if (dueFilter === "today") return d >= todayStart && d <= todayEnd;
    if (dueFilter === "week") return d >= todayStart && d <= weekEnd;
    return true;
  });
}

function TasksCalendar({ tasks, onSelectTask }: { tasks: Task[]; onSelectTask: (t: Task) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = format(parseISO(t.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div className="rounded-lg border border-[#d9dee7] bg-white">
      <div className="flex items-center justify-between border-b border-[#f1f1f1] px-3 py-2">
        <h3 className="font-mono text-sm font-semibold">{format(month, "MMMM yyyy")}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(addDays(startOfMonth(month), -15))}>←</Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setMonth(addDays(endOfMonth(month), 15))}>→</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-[#f1f1f1] bg-[#fafafa]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = byDay.get(key) || [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-[84px] border-b border-r border-[#f1f1f1] p-1 [&:nth-child(7n)]:border-r-0",
                !isSameMonth(day, month) && "bg-[#fafafa]/60 text-muted-foreground"
              )}
            >
              <p className={cn("px-1 font-mono text-[11px]", isToday(day) && "font-bold text-[#1677ff]")}>
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="block w-full truncate rounded border border-[#91caff] bg-[#e6f4ff] px-1 py-0.5 text-left text-[11px] text-[#002c8c] hover:bg-[#bae0ff]"
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"board" | "list" | "calendar">("board");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showKbdHint, setShowKbdHint] = useState(true);
  const [editTitle, setEditTitle] = useState<string>("");

  useRealtime({ enabled: true });

  useOpenCreateDialog("task", () => setCreateOpen(true));

  const activeDomainId = useApiDomain();

  const { data: projectsData } = useApiQuery<PaginatedResponse<{ id: string; name: string; color?: string | null }>>(
    ["projects", activeDomainId],
    "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );
  const projects = projectsData?.items || [];
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const [filterProjectId, setFilterProjectId] = useState("");
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const savedViews = useSavedViewsStore((s) => s.views);
  const addSavedView = useSavedViewsStore((s) => s.addView);
  const removeSavedView = useSavedViewsStore((s) => s.removeView);

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", filterProjectId],
    "/states?projectId=" + filterProjectId,
    { enabled: !!filterProjectId }
  );
  const projectStates = useMemo(() => (statesData?.items || []).sort((a, b) => a.sortOrder - b.sortOrder), [statesData]);

  const stateById = useMemo(() => {
    const map = new Map<string, State>();
    for (const s of projectStates) map.set(s.id, s);
    return map;
  }, [projectStates]);

  const groupedQuery = useQuery({
    queryKey: ["task-groups", activeDomainId, filterProjectId],
    queryFn: () =>
      api.get<{ groups: { id: string; name: string; color: string | null; group?: string; tasks: Task[] }[]; totalItems: number }>(
        "/tasks/grouped?group_by=state" + (activeDomainId ? "&domain=" + activeDomainId : "") + (filterProjectId ? "&project_id=" + filterProjectId : "")
      ),
    enabled: !!filterProjectId,
  });

  const taskQueryParams = () =>
    new URLSearchParams({
      limit: "200",
      ...(activeDomainId ? { domain: activeDomainId } : {}),
      ...(search ? { search } : {}),
      ...(filterProjectId ? { project_id: filterProjectId } : {}),
      ...(selectedStateId ? { state_id: selectedStateId } : {}),
      ...(priority ? { priority } : {}),
    }).toString();

  const { data: tasksData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Task>>(
    ["tasks", activeDomainId, search, filterProjectId, selectedStateId, priority],
    "/tasks?" + taskQueryParams()
  );

  const allTasks = tasksData?.items || [];
  const tasks = useMemo(() => applyDueFilter(allTasks, dueFilter), [allTasks, dueFilter]);
  const hasMoreTasks = allTasks.length < (tasksData?.totalItems || 0);
  const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);

  // Keyboard navigation for list view
  useEffect(() => {
    if (view !== "list") return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')
      ) {
        return;
      }

      setShowKbdHint(false);

      const hasSelection = selectedTaskIds.size > 0;
      const currentIdx = selectedRowIndex >= 0 ? selectedRowIndex : 0;

      switch (e.key) {
        case "j":
          if (!e.shiftKey) {
            e.preventDefault();
            setSelectedRowIndex((prev) => {
              const next = Math.min(prev + 1, tasks.length - 1);
              const row = document.querySelector(`[data-row-index="${next}"]`);
              row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              return next;
            });
          }
          break;
        case "k":
          if (!e.shiftKey) {
            e.preventDefault();
            setSelectedRowIndex((prev) => {
              const next = Math.max(prev - 1, 0);
              const row = document.querySelector(`[data-row-index="${next}"]`);
              row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              return next;
            });
          }
          break;
        case "Enter":
          if (selectedRowIndex >= 0 && selectedRowIndex < tasks.length) {
            e.preventDefault();
            openTaskPanel(tasks[selectedRowIndex]);
          }
          break;
        case "e":
          if (selectedRowIndex >= 0 && selectedRowIndex < tasks.length) {
            e.preventDefault();
            const task = tasks[selectedRowIndex];
            setEditingTaskId(task.id);
            setEditTitle(task.title);
          }
          break;
        case "x":
          if (selectedRowIndex >= 0 && selectedRowIndex < tasks.length) {
            e.preventDefault();
            const task = tasks[selectedRowIndex];
            const newStatus = task.status === "done" ? "todo" : "done";
            api.patch(`/tasks/${task.id}`, { status: newStatus }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["tasks"] });
            });
          }
          break;
        case "Escape":
          if (hasSelection) {
            setSelectedTaskIds(new Set());
          } else {
            setSelectedRowIndex(-1);
          }
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [view, tasks, selectedRowIndex, selectedTaskIds, queryClient]);

  // Hide kbd hint after 5 seconds
  useEffect(() => {
    if (!showKbdHint) return;
    const timer = setTimeout(() => setShowKbdHint(false), 5000);
    return () => clearTimeout(timer);
  }, [showKbdHint]);

  const loadMoreTasks = async () => {
    if (!hasMoreTasks || loadingMoreTasks) return;
    setLoadingMoreTasks(true);
    try {
      const next = await api.get<PaginatedResponse<Task>>(
        "/tasks?" + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(taskQueryParams())), offset: String(allTasks.length) }).toString()
      );
      queryClient.setQueryData<PaginatedResponse<Task>>(["tasks", activeDomainId, search, filterProjectId, selectedStateId, priority], (old) => {
        if (!old) return old;
        const seen = new Set(old.items.map((t) => t.id));
        return { ...old, items: [...old.items, ...next.items.filter((t) => !seen.has(t.id))] };
      });
    } finally {
      setLoadingMoreTasks(false);
    }
  };

  const stateUpdateMutation = useMutation({
    mutationFn: ({ taskId, stateId }: { taskId: string; stateId: string }) =>
      api.patch<Task>("/tasks/" + taskId, { stateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-groups"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const statusUpdateMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api.patch<Task>("/tasks/" + taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: ({ orderedIds }: { orderedIds: string[] }) =>
      api.post("/tasks/reorder", { orderedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Bulk action handlers
  const handleBulkComplete = useCallback(() => {
    const ids = Array.from(selectedTaskIds);
    Promise.all(ids.map((id) => api.patch(`/tasks/${id}`, { status: "done" }))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTaskIds(new Set());
      toast.success(`${ids.length} tasks marked as done`);
    });
  }, [selectedTaskIds, queryClient]);

  const handleBulkUpdate = useCallback((updates: Partial<Task>) => {
    const ids = Array.from(selectedTaskIds);
    Promise.all(ids.map((id) => api.patch(`/tasks/${id}`, updates))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTaskIds(new Set());
      toast.success(`${ids.length} tasks updated`);
    });
  }, [selectedTaskIds, queryClient]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedTaskIds);
    Promise.all(ids.map((id) => api.delete(`/tasks/${id}`))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTaskIds(new Set());
      toast.success(`${ids.length} tasks deleted`);
    });
  }, [selectedTaskIds, queryClient]);

  const handleSaveEdit = useCallback(() => {
    if (editingTaskId && editTitle.trim()) {
      api.patch(`/tasks/${editingTaskId}`, { title: editTitle.trim() }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        setEditingTaskId(null);
        setEditTitle("");
      });
    }
  }, [editingTaskId, editTitle, queryClient]);

  const toggleAll = useCallback(() => {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map((t) => t.id)));
    }
  }, [selectedTaskIds, tasks]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/tasks/" + id),
    onSuccess: (_, deletedId) => {
      const task = tasks.find((t) => t.id === deletedId);
      if (task) {
        showUndoToast(
          "task",
          deletedId,
          {
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            description: task.description,
            domain: task.domainId || undefined,
          },
          queryClient,
          ["tasks"],
        );
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setPanelOpen(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnOfTask = useCallback(
    (task: Task): string => {
      if (filterProjectId) return task.stateId || "__none__";
      return task.status || "todo";
    },
    [filterProjectId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    const columnTasks = (colId: string) =>
      tasks
        .filter((t) => columnOfTask(t) === colId)
        .sort((a, b) => a.order - b.order);

    const allColumnIds = columns.map((c) => c.id);
    let targetColumn: string;
    let insertIndex: number;
    if (allColumnIds.includes(overId)) {
      targetColumn = overId;
      insertIndex = -1;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetColumn = columnOfTask(overTask);
      const overIndex = columnTasks(targetColumn).findIndex((t) => t.id === overId);
      insertIndex = overIndex === -1 ? -1 : overIndex;
    }

    const targetIds = columnTasks(targetColumn)
      .map((t) => t.id)
      .filter((id) => id !== taskId);
    if (insertIndex === -1) {
      targetIds.push(taskId);
    } else {
      targetIds.splice(Math.min(insertIndex, targetIds.length), 0, taskId);
    }

    const currentIds = columnTasks(targetColumn).map((t) => t.id);
    const unchanged =
      currentIds.length === targetIds.length &&
      currentIds.every((id, i) => id === targetIds[i]);
    if (unchanged) return;

    const groupChanged = columnOfTask(draggedTask) !== targetColumn;
    const orderById = new Map(targetIds.map((id, i) => [id, i]));
    queryClient.setQueryData<PaginatedResponse<Task>>(["tasks", activeDomainId, search, filterProjectId, selectedStateId, priority], (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((t) => {
          const order = orderById.get(t.id);
          return order !== undefined ? { ...t, order } : t;
        }),
      };
    });

    if (groupChanged) {
      if (filterProjectId && targetColumn !== "__none__") {
        stateUpdateMutation.mutate({ taskId, stateId: targetColumn });
      } else if (!filterProjectId) {
        const statusMap: Record<string, string> = { todo: "todo", in_progress: "in_progress", done: "done", cancelled: "cancelled" };
        if (statusMap[targetColumn]) statusUpdateMutation.mutate({ taskId, status: statusMap[targetColumn] });
      }
    }
    reorderMutation.mutate({ orderedIds: targetIds });
  };

  const openTaskDetail = (task: Task) => {
    navigate({ to: "/tasks/$id", params: { id: task.id } });
  };

  const openTaskPanel = (task: Task) => {
    setSelectedTask(task);
    setPanelTaskId(task.id);
    setPanelOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterProjectId("");
    setSelectedStateId("");
    setPriority("");
    setDueFilter("all");
  };

  const columns = useMemo(() => {
    if (filterProjectId) {
      const groups = groupedQuery.data?.groups;
      if (groups) {
        return groups.map((g) => ({
          id: g.id,
          label: g.name,
          color: g.color,
          tasks: applyDueFilter(
            g.tasks.filter((t) =>
              (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
              (!selectedStateId || t.stateId === selectedStateId) &&
              (!priority || t.priority === priority)
            ),
            dueFilter
          ).sort((a, b) => a.order - b.order),
        }));
      }
      return projectStates.map((s) => ({
        id: s.id,
        label: s.name,
        color: s.color,
        tasks: tasks.filter((t) => t.stateId === s.id).sort((a, b) => a.order - b.order),
      }));
    }
    return FALLBACK_COLUMNS.map((col) => ({
      id: col.id,
      label: col.label,
      colorClass: col.colorClass,
      tasks: tasks.filter((t) => col.statuses.includes(t.status)).sort((a, b) => a.order - b.order),
    }));
  }, [filterProjectId, groupedQuery.data, projectStates, tasks, search, selectedStateId, priority, dueFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list" | "calendar")}>
            <TabsList>
              <TabsTrigger value="board" aria-label="Board view"><LayoutIcon className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="list" aria-label="List view"><ListTodo className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="calendar" aria-label="Calendar view"><CalendarDays className="h-4 w-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button aria-label="New task"><Plus className="mr-2 h-4 w-4" />New Task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Task</DialogTitle>
              </DialogHeader>
              <TaskForm onClose={() => setCreateOpen(false)} projectId={filterProjectId || undefined} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <QuickAddBar projectId={filterProjectId || undefined} onMoreOptions={() => setCreateOpen(true)} />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        projects={projects}
        projectId={filterProjectId}
        onProjectChange={(v) => { setFilterProjectId(v); setSelectedStateId(""); }}
        states={projectStates}
        stateId={selectedStateId}
        onStateChange={setSelectedStateId}
        priority={priority}
        onPriorityChange={setPriority}
        dueFilter={dueFilter}
        onDueChange={setDueFilter}
        onClearAll={clearFilters}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {savedViews.length > 0 && (
          <Select
            value=""
            onValueChange={(vid) => {
              const v = savedViews.find((sv) => sv.id === vid);
              if (v) {
                setSearch(v.filters.search);
                setFilterProjectId(v.filters.projectId);
                setSelectedStateId(v.filters.stateId);
                setPriority(v.filters.priority);
              }
            }}
          >
            <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Saved views" /></SelectTrigger>
            <SelectContent>
              {savedViews.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="flex items-center gap-2">
                    <Bookmark className="h-3 w-3" />
                    {v.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Bookmark className="h-3.5 w-3.5" /> Save View
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Save Current Filters</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="View name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && viewName.trim()) {
                    addSavedView(viewName.trim(), { search, projectId: filterProjectId, stateId: selectedStateId, priority });
                    setViewName("");
                    setSaveViewOpen(false);
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
                <Button
                  disabled={!viewName.trim()}
                  onClick={() => {
                    addSavedView(viewName.trim(), { search, projectId: filterProjectId, stateId: selectedStateId, priority });
                    setViewName("");
                    setSaveViewOpen(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {savedViews.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {savedViews.map((v) => (
              <Badge key={v.id} variant="outline" className="gap-1 text-[10px]">
                {v.name}
                <button
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => removeSavedView(v.id)}
                  aria-label={`Remove saved view ${v.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Loading tasks..." />
      ) : isError ? (
        <ErrorState message="Failed to load tasks." onRetry={() => refetch()} />
      ) : view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {columns.map((col) => (
              <ColumnDroppable key={col.id} id={col.id} className="rounded-lg border border-[#d9dee7] bg-[#f7f8fa] p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {"color" in col && col.color ? (
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color as string }} />
                    ) : (
                      <div className={cn("h-2 w-2 rounded-full", (col as any).colorClass || "bg-slate-400")} />
                    )}
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="secondary" className="font-mono text-[10px]">{col.tasks.length}</Badge>
                  </div>
                </div>
                <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="min-h-[100px] space-y-1.5">
                    {col.tasks.map((task) => {
                      const st = task.stateId ? stateById.get(task.stateId) : undefined;
                      return (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          stateName={st?.name}
                          stateColor={st?.color}
                          projectName={!filterProjectId ? projectById.get(task.projectId || "")?.name : undefined}
                          onClick={() => openTaskPanel(task)}
                          onEdit={() => openTaskPanel(task)}
                        />
                      );
                    })}
                    {col.tasks.length === 0 && (
                      <p className="py-4 text-center text-xs text-muted-foreground">No tasks</p>
                    )}
                  </div>
                </SortableContext>
              </ColumnDroppable>
            ))}
          </div>
          <DragOverlay>
            {activeId ? <div className="rounded-lg border bg-card p-3 opacity-80 shadow-lg">Moving...</div> : null}
          </DragOverlay>
        </DndContext>
      ) : view === "calendar" ? (
        <TasksCalendar tasks={tasks} onSelectTask={openTaskPanel} />
      ) : (
        <div className="relative rounded-lg border border-[#d9dee7] bg-white">
          {view === "list" && showKbdHint && (
            <div className="absolute right-0 top-0 z-10 flex gap-3 p-2 text-[10px] text-muted-foreground">
              <span><kbd className="rounded border bg-muted px-1 py-0.5 font-mono">j</kbd>/<kbd className="rounded border bg-muted px-1 py-0.5 font-mono">k</kbd> navigate</span>
              <span><kbd className="rounded border bg-muted px-1 py-0.5 font-mono">Enter</kbd> open</span>
              <span><kbd className="rounded border bg-muted px-1 py-0.5 font-mono">e</kbd> edit</span>
              <span><kbd className="rounded border bg-muted px-1 py-0.5 font-mono">x</kbd> toggle</span>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {selectedTaskIds.size > 0 && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedTaskIds.size === tasks.length && tasks.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                )}
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={selectedTaskIds.size > 0 ? 6 : 5}>
                    <EmptyState title="No tasks found" />
                  </TableCell>
                </TableRow>
              ) : tasks.map((task, idx) => {
                const st = task.stateId ? stateById.get(task.stateId) : undefined;
                return (
                  <TableRow
                    key={task.id}
                    data-row-index={idx}
                    className={cn(
                      "cursor-pointer py-2 hover:bg-muted/30",
                      idx === selectedRowIndex && "bg-accent/50 ring-1 ring-[hsl(var(--accent-hsl))]"
                    )}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) {
                        setSelectedTaskIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(task.id)) {
                            next.delete(task.id);
                          } else {
                            next.add(task.id);
                          }
                          return next;
                        });
                      } else {
                        openTaskPanel(task);
                      }
                    }}
                  >
                    {selectedTaskIds.size > 0 && (
                      <TableCell className="w-10 py-2">
                        <Checkbox
                          checked={selectedTaskIds.has(task.id)}
                          onCheckedChange={(checked) => {
                            setSelectedTaskIds((prev) => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(task.id);
                              } else {
                                next.delete(task.id);
                              }
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell className="py-2 font-medium">
                      {editingTaskId === task.id ? (
                        <Input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="h-7 text-sm"
                          onBlur={handleSaveEdit}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter") {
                              ev.preventDefault();
                              handleSaveEdit();
                            }
                            if (ev.key === "Escape") {
                              setEditingTaskId(null);
                              setEditTitle("");
                            }
                          }}
                        />
                      ) : (
                        <span className="font-medium">{task.title}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {st ? (
                        <Badge variant="secondary" className="gap-1 font-mono text-[10px]" style={st.color ? { backgroundColor: st.color + "20", color: st.color } : undefined}>
                          <span className="h-1.5 w-1.5 rounded-full" style={st.color ? { backgroundColor: st.color } : undefined} />
                          {st.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={cn("font-mono text-[10px]", PRIORITY[task.priority]?.badge)}>{task.priority}</Badge>
                    </TableCell>
                    <TableCell className="py-2 font-mono text-[10px] text-muted-foreground">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openTaskPanel(task)}>Quick view</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openTaskDetail(task)}>Open full page</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(task.id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {selectedTaskIds.size > 0 && (
            <BulkActionBar
              selectedCount={selectedTaskIds.size}
              selectedIds={Array.from(selectedTaskIds)}
              projectStates={projectStates}
              onClearSelection={() => setSelectedTaskIds(new Set())}
              onComplete={handleBulkComplete}
              onBatchUpdate={handleBulkUpdate}
              onBatchDelete={handleBulkDelete}
            />
          )}
        </div>
      )}

      {hasMoreTasks && view !== "calendar" && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMoreTasks} disabled={loadingMoreTasks}>
            {loadingMoreTasks ? "Loading..." : "Load more tasks"}
          </Button>
        </div>
      )}

      <TaskDetailPanel
        taskId={panelTaskId}
        open={panelOpen}
        onOpenChange={(o) => {
          setPanelOpen(o);
          if (!o) {
            setPanelTaskId(null);
            setSelectedTask(null);
          }
        }}
        onOpenFullPage={(t) => {
          setPanelOpen(false);
          openTaskDetail(t);
        }}
      />

      {selectedTask && !panelOpen && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <span className="hidden" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to delete "{selectedTask.title}"? This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(selectedTask.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/tasks",
  component: TasksPage,
});
