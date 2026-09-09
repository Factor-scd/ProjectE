import { useState, useCallback, useMemo } from "react";
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
import { Plus, GripVertical, Pencil, Trash2, Calendar, ListTodo, Layout as LayoutIcon, Search, MoreHorizontal } from "lucide-react";
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
import { EntityDetailPanel } from "@/components/entities/entity-detail-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { CustomFieldInputs } from "@/components/custom-fields/custom-field-inputs";
import { PRIORITY } from "@/lib/status-colors";
import type { Task, State, StateGroup, PaginatedResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseTaskInput } from "@/lib/nlp";
import { RecurrencePicker } from "@/components/tasks/recurrence-picker";

const STATE_GROUP_COLUMNS: { id: StateGroup; label: string; colorClass: string }[] = [
  { id: "backlog", label: "Backlog", colorClass: "bg-slate-400" },
  { id: "unstarted", label: "Unstarted", colorClass: "bg-slate-500" },
  { id: "started", label: "Started", colorClass: "bg-blue-500" },
  { id: "completed", label: "Completed", colorClass: "bg-green-500" },
  { id: "cancelled", label: "Cancelled", colorClass: "bg-red-500" },
];

function SortableTaskCard({ task, stateName, stateColor, onClick, onEdit }: { task: Task; stateName?: string; stateColor?: string | null; onClick: () => void; onEdit?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-pointer border rounded-lg transition-colors hover:bg-muted/20" onClick={onClick}>
        <CardContent className="p-2.5">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {stateName && (
                  <Badge variant="secondary" className="font-mono text-[10px] gap-1" style={stateColor ? { backgroundColor: stateColor + "20", color: stateColor } : undefined}>
                    <span className="h-1.5 w-1.5 rounded-full" style={stateColor ? { backgroundColor: stateColor } : undefined} />
                    {stateName}
                  </Badge>
                )}
                {task.dueDate && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
                <Badge variant="secondary" className={cn("font-mono text-[10px]", PRIORITY[task.priority]?.badge)}>
                  {PRIORITY[task.priority]?.label ?? task.priority}
                </Badge>
                {task.tags?.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="font-mono text-[10px]" style={{ borderColor: tag.color || undefined }}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -mt-1 -mr-1 shrink-0"
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
          <div className="flex flex-wrap gap-1 mt-1.5">
            {parsed.dueDate && <Badge variant="outline" className="text-[10px]">Due {new Date(parsed.dueDate).toLocaleDateString()} {new Date(parsed.dueDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Badge>}
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

function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useRealtime({ enabled: true });

  useOpenCreateDialog("task", () => setCreateOpen(true));

  const activeDomainId = useApiDomain();

  const { data: projectsData } = useApiQuery<PaginatedResponse<{ id: string; name: string }>>(
    ["projects", activeDomainId],
    "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );
  const projects = projectsData?.items || [];

  const [filterProjectId, setFilterProjectId] = useState("");

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", filterProjectId],
    "/states?projectId=" + filterProjectId,
    { enabled: !!filterProjectId }
  );
  const projectStates = statesData?.items || [];

  const stateGroupOf = useMemo(() => {
    const map = new Map<string, StateGroup>();
    for (const s of projectStates) map.set(s.id, s.group);
    return map;
  }, [projectStates]);

  const stateById = useMemo(() => {
    const map = new Map<string, State>();
    for (const s of projectStates) map.set(s.id, s);
    return map;
  }, [projectStates]);

  const taskQueryParams = () =>
    new URLSearchParams({
      limit: "200",
      ...(activeDomainId ? { domain: activeDomainId } : {}),
      ...(search ? { search } : {}),
      ...(filterProjectId ? { project_id: filterProjectId } : {}),
      ...(selectedStateId ? { state_id: selectedStateId } : {}),
    }).toString();

  const { data: tasksData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Task>>(
    ["tasks", activeDomainId, search, filterProjectId, selectedStateId],
    "/tasks?" + taskQueryParams()
  );

  const tasks = tasksData?.items || [];
  const hasMoreTasks = tasks.length < (tasksData?.totalItems || 0);
  const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);

  const loadMoreTasks = async () => {
    if (!hasMoreTasks || loadingMoreTasks) return;
    setLoadingMoreTasks(true);
    try {
      const next = await api.get<PaginatedResponse<Task>>(
        "/tasks?" + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(taskQueryParams())), offset: String(tasks.length) }).toString()
      );
      queryClient.setQueryData<PaginatedResponse<Task>>(["tasks", activeDomainId, search, filterProjectId, selectedStateId], (old) => {
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
    },
    onError: () => {
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/tasks/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setPanelOpen(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const taskGroupOf = useCallback(
    (task: Task): StateGroup => {
      if (task.stateId) {
        const group = stateGroupOf.get(task.stateId);
        if (group) return group;
      }
      return "unstarted";
    },
    [stateGroupOf]
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

    const columnTasks = (group: StateGroup) =>
      tasks
        .filter((t) => taskGroupOf(t) === group)
        .sort((a, b) => a.order - b.order);

    let targetGroup: StateGroup;
    let insertIndex: number;
    if (STATE_GROUP_COLUMNS.some((c) => c.id === overId)) {
      targetGroup = overId as StateGroup;
      insertIndex = -1;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetGroup = taskGroupOf(overTask);
      const overIndex = columnTasks(targetGroup).findIndex((t) => t.id === overId);
      insertIndex = overIndex === -1 ? -1 : overIndex;
    }

    const targetIds = columnTasks(targetGroup)
      .map((t) => t.id)
      .filter((id) => id !== taskId);
    if (insertIndex === -1) {
      targetIds.push(taskId);
    } else {
      targetIds.splice(Math.min(insertIndex, targetIds.length), 0, taskId);
    }

    const currentIds = columnTasks(targetGroup).map((t) => t.id);
    const unchanged =
      currentIds.length === targetIds.length &&
      currentIds.every((id, i) => id === targetIds[i]);
    if (unchanged) return;

    const groupChanged = taskGroupOf(draggedTask) !== targetGroup;
    const orderById = new Map(targetIds.map((id, i) => [id, i]));
    queryClient.setQueryData<PaginatedResponse<Task>>(["tasks", activeDomainId, search, filterProjectId, selectedStateId], (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((t) => {
          const order = orderById.get(t.id);
          return order !== undefined ? { ...t, order } : t;
        }),
      };
    });

    if (groupChanged && draggedTask.projectId) {
      const firstStateInGroup = projectStates.find((s) => s.group === targetGroup && s.projectId === draggedTask.projectId);
      if (firstStateInGroup) {
        stateUpdateMutation.mutate({ taskId, stateId: firstStateInGroup.id });
      }
    }
    reorderMutation.mutate({ orderedIds: targetIds });
  };

  const openTaskDetail = (task: Task) => {
    navigate({ to: "/tasks/$id", params: { id: task.id } });
  };

  const openTaskPanel = (task: Task) => {
    setSelectedTask(task);
    setPanelOpen(true);
  };

  const columns = useMemo(() => {
    return STATE_GROUP_COLUMNS.map((col) => ({
      ...col,
      tasks: tasks
        .filter((t) => taskGroupOf(t) === col.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [tasks, taskGroupOf]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tasks</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "list")}>
            <TabsList>
              <TabsTrigger value="board" aria-label="Board view"><LayoutIcon className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="list" aria-label="List view"><ListTodo className="h-4 w-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button aria-label="New task"><Plus className="h-4 w-4 mr-2" />New Task</Button>
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

      <div className="flex gap-1.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterProjectId} onValueChange={setFilterProjectId}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterProjectId && projectStates.length > 0 && (
          <Select value={selectedStateId} onValueChange={setSelectedStateId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All states" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All states</SelectItem>
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
        )}
      </div>

      {isLoading ? (
        <LoadingState label="Loading tasks..." />
      ) : isError ? (
        <ErrorState message="Failed to load tasks." onRetry={() => refetch()} />
      ) : view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {columns.map((col) => (
              <ColumnDroppable key={col.id} id={col.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", col.colorClass)} />
                    <h3 className="font-semibold text-sm">{col.label}</h3>
                    <Badge variant="secondary" className="font-mono text-[10px]">{col.tasks.length}</Badge>
                  </div>
                </div>
                <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5 min-h-[100px]">
                    {col.tasks.map((task) => {
                      const st = task.stateId ? stateById.get(task.stateId) : undefined;
                      return (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          stateName={st?.name}
                          stateColor={st?.color}
                          onClick={() => openTaskDetail(task)}
                          onEdit={() => openTaskPanel(task)}
                        />
                      );
                    })}
                    {col.tasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                    )}
                  </div>
                </SortableContext>
              </ColumnDroppable>
            ))}
          </div>
          <DragOverlay>
            {activeId ? <div className="p-3 bg-card rounded-lg shadow-lg border opacity-80">Moving...</div> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={5}>
                    <EmptyState title="No tasks found" />
                  </TableCell>
                </TableRow>
              ) : tasks.map((task) => {
                const st = task.stateId ? stateById.get(task.stateId) : undefined;
                return (
                  <TableRow key={task.id} className="cursor-pointer hover:bg-muted/30 py-2" onClick={() => openTaskDetail(task)}>
                    <TableCell className="font-medium py-2">{task.title}</TableCell>
                    <TableCell className="py-2">
                      {st ? (
                        <Badge variant="secondary" className="font-mono text-[10px] gap-1" style={st.color ? { backgroundColor: st.color + "20", color: st.color } : undefined}>
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
                    <TableCell className="font-mono text-[10px] text-muted-foreground py-2">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openTaskPanel(task)}>Edit</DropdownMenuItem>
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
        </div>
      )}

      {hasMoreTasks && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMoreTasks} disabled={loadingMoreTasks}>
            {loadingMoreTasks ? "Loading..." : "Load more tasks"}
          </Button>
        </div>
      )}

      <EntityDetailPanel open={panelOpen} onOpenChange={setPanelOpen} title={selectedTask?.title || "Task Details"}>
        {selectedTask && (
    <div className="space-y-3">
            <TaskForm task={selectedTask} onClose={() => setPanelOpen(false)} />
            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Task</Button>
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
            </div>
          </div>
        )}
      </EntityDetailPanel>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/tasks",
  component: TasksPage,
});
