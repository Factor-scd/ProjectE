import { useState, useCallback, useMemo } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Pencil, Trash2, Calendar, Clock, ListTodo, Layout as LayoutIcon, Search, Filter, MoreHorizontal } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityDetailPanel } from "@/components/entities/entity-detail-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { CustomFieldInputs } from "@/components/custom-fields/custom-field-inputs";
import { TASK_STATUS, PRIORITY } from "@/lib/status-colors";
import type { Task, PaginatedResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLUMNS = [
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];

function SortableTaskCard({ task, onClick, onEdit }: { task: Task; onClick: () => void; onEdit?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {task.dueDate && (
                  <Badge variant="outline" className="text-[10px]">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </Badge>
                )}
                <Badge variant="secondary" className={cn("text-[10px]", PRIORITY[task.priority]?.badge)}>
                  {PRIORITY[task.priority]?.label ?? task.priority}
                </Badge>
                {task.tags?.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="text-[10px]" style={{ borderColor: tag.color || undefined }}>
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

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [status, setStatus] = useState(task?.status || "todo");
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(() => ({ ...(task?.customFields ?? {}) }));

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
    const data: any = { title: title.trim(), description: description || null, status, priority };
    if (dueDate) data.dueDate = new Date(dueDate).toISOString();
    const customFields = { ...customFieldValues };
    if (Object.keys(customFields).length > 0) data.customFields = customFields;
    if (task) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "todo" | "in_progress" | "done" | "cancelled")}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useRealtime({ enabled: true });

  const activeDomainId = useApiDomain();

  const { data: tasksData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Task>>(
    ["tasks", activeDomainId, search, statusFilter],
    "/tasks?" + new URLSearchParams({ limit: "200", ...(activeDomainId ? { domain: activeDomainId } : {}), ...(search ? { search } : {}), ...(statusFilter ? { status: statusFilter } : {}) }).toString()
  );

  const tasks = tasksData?.items || [];

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post("/tasks/" + id + "/status", { status }),
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

    // Tasks of a column in persisted order
    const columnTasks = (status: string) =>
      tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.order - b.order);

    // Decide the target column and insertion index:
    // - over a column id  => drop at the end of that column (handles empty columns)
    // - over a task id    => drop at that task's position within its column
    let targetColumn: string;
    let insertIndex: number;
    if (STATUS_COLUMNS.some((c) => c.id === overId)) {
      targetColumn = overId;
      insertIndex = -1;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetColumn = overTask.status;
      const overIndex = columnTasks(targetColumn).findIndex((t) => t.id === overId);
      insertIndex = overIndex === -1 ? -1 : overIndex;
    }

    // Build the new ordered id list for the target column
    const targetIds = columnTasks(targetColumn)
      .map((t) => t.id)
      .filter((id) => id !== taskId);
    if (insertIndex === -1) {
      targetIds.push(taskId);
    } else {
      targetIds.splice(Math.min(insertIndex, targetIds.length), 0, taskId);
    }

    // No-op when the task is already in that exact spot
    const currentIds = columnTasks(targetColumn).map((t) => t.id);
    const unchanged =
      currentIds.length === targetIds.length &&
      currentIds.every((id, i) => id === targetIds[i]);
    if (unchanged) return;

    // Optimistic local update so the board reorders immediately
    const statusChanged = draggedTask.status !== targetColumn;
    const orderById = new Map(targetIds.map((id, i) => [id, i]));
    queryClient.setQueryData<PaginatedResponse<Task>>(["tasks", activeDomainId, search, statusFilter], (old) => {
      if (!old) return old;
      return {
        ...old,
        items: old.items.map((t) => {
          if (t.id === taskId && statusChanged) {
            return { ...t, status: targetColumn as Task["status"], order: orderById.get(t.id) ?? t.order };
          }
          const order = orderById.get(t.id);
          return order !== undefined ? { ...t, order } : t;
        }),
      };
    });

    if (statusChanged) {
      statusMutation.mutate({ id: taskId, status: targetColumn });
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
    return STATUS_COLUMNS.map((col) => ({
      ...col,
      color: TASK_STATUS[col.id].dot,
      tasks: tasks
        .filter((t) => t.status === col.id)
        .sort((a, b) => a.order - b.order),
    }));
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
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
              <TaskForm onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">All statuses</SelectItem>
            {STATUS_COLUMNS.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading tasks..." />
      ) : isError ? (
        <ErrorState message="Failed to load tasks." onRetry={() => refetch()} />
      ) : view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((col) => (
              <ColumnDroppable key={col.id} id={col.id} className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", col.color)} />
                    <h3 className="font-semibold text-sm">{col.label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{col.tasks.length}</Badge>
                  </div>
                </div>
                <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 min-h-[100px]">
                    {col.tasks.map((task) => (
                      <SortableTaskCard key={task.id} task={task} onClick={() => openTaskDetail(task)} onEdit={() => openTaskPanel(task)} />
                    ))}
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
                <TableHead>Status</TableHead>
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
              ) : tasks.map((task) => (
                <TableRow key={task.id} className="cursor-pointer" onClick={() => openTaskDetail(task)}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", TASK_STATUS[task.status]?.badge)}>{task.status.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[10px]", PRIORITY[task.priority]?.badge)}>{task.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EntityDetailPanel open={panelOpen} onOpenChange={setPanelOpen} title={selectedTask?.title || "Task Details"}>
        {selectedTask && (
          <div className="space-y-4">
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
