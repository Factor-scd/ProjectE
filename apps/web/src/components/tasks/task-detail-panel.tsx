import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Calendar, Flag, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TagManager } from "@/components/entities/tag-manager";
import { PRIORITY } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { State, Task } from "@/lib/types";

interface TaskDetailPanelProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFullPage?: (task: Task) => void;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export function TaskDetailPanel({ taskId, open, onOpenChange, onOpenFullPage }: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const [newSubtask, setNewSubtask] = useState("");

  const { data: task, isLoading } = useApiQuery<Task>(["task", taskId || ""], "/tasks/" + taskId, {
    enabled: open && !!taskId,
  });

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", task?.projectId || ""],
    "/states?projectId=" + (task?.projectId || ""),
    { enabled: open && !!task?.projectId }
  );
  const projectStates = statesData?.items || [];
  const currentState = task?.stateId ? projectStates.find((s) => s.id === task.stateId) : null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["task-groups"] });
    if (taskId) queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    if (task?.projectId) queryClient.invalidateQueries({ queryKey: ["project", task.projectId] });
  };

  const patchMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<Task>(`/tasks/${taskId}`, data),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const addSubtaskMutation = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>("/tasks", { title, parentId: taskId, projectId: task?.projectId || null, domain: task?.domainId }),
    onSuccess: () => {
      setNewSubtask("");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      toast.success("Task deleted");
      refresh();
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const subtasks = task?.subtasks || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-md">
        <SheetHeader className="border-b border-[#f1f1f1] px-4 py-3">
          <SheetTitle className="text-sm text-muted-foreground">Task details</SheetTitle>
        </SheetHeader>
        {isLoading || !task ? (
          <p className="p-4 text-sm text-muted-foreground">{isLoading ? "Loading..." : "Select a task"}</p>
        ) : (
          <ScrollArea className="h-[calc(100vh-8rem)] px-4 py-3">
            <div className="space-y-4">
              <Input
                defaultValue={task.title}
                key={task.id + task.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== task.title) patchMutation.mutate({ title: v });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-9 text-base font-semibold"
                aria-label="Task title"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                {currentState ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[11px]"
                    style={currentState.color ? { backgroundColor: currentState.color + "20", color: currentState.color } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={currentState.color ? { backgroundColor: currentState.color } : undefined} />
                    {currentState.name}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px]">No state</Badge>
                )}
                <Badge variant="outline" className={cn("text-[11px]", PRIORITY[task.priority]?.badge)}>
                  {PRIORITY[task.priority]?.label ?? task.priority}
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="text-[11px]">
                    <Calendar className="mr-1 h-3 w-3" />
                    {format(parseISO(task.dueDate), "MMM d, yyyy")}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">State</Label>
                  <Select
                    value={task.stateId || "__none__"}
                    onValueChange={(v) => patchMutation.mutate({ stateId: v === "__none__" ? null : v })}
                    disabled={projectStates.length === 0}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="No state" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No state</SelectItem>
                      {projectStates.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Priority</Label>
                  <Select value={task.priority} onValueChange={(v) => patchMutation.mutate({ priority: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Due date
                  </Label>
                  <Input
                    type="date"
                    className="h-8"
                    defaultValue={task.dueDate ? task.dueDate.slice(0, 10) : ""}
                    key={task.id + (task.dueDate || "")}
                    onChange={(e) => patchMutation.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div>
                  <Label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Flag className="h-3 w-3" /> Estimate
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8"
                    defaultValue={task.estimatedMinutes ?? ""}
                    key={task.id + (task.estimatedMinutes ?? "")}
                    placeholder="Minutes"
                    onBlur={(e) => {
                      const v = e.target.value ? parseInt(e.target.value, 10) : null;
                      patchMutation.mutate({ estimatedMinutes: v });
                    }}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">Description</Label>
                <Textarea
                  defaultValue={task.description || ""}
                  key={task.id + (task.description || "")}
                  rows={3}
                  placeholder="Add a description…"
                  onBlur={(e) => {
                    if (e.target.value !== (task.description || "")) {
                      patchMutation.mutate({ description: e.target.value || null });
                    }
                  }}
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Subtasks {subtasks.length > 0 && `(${subtasks.length})`}
                </p>
                {subtasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No subtasks yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {subtasks.map((s) => (
                      <TaskSubtaskRow key={s.id} subtask={s} projectStates={projectStates} onChanged={refresh} />
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex gap-1.5">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newSubtask.trim()) addSubtaskMutation.mutate(newSubtask.trim());
                      }
                    }}
                    placeholder="Add subtask…"
                    className="h-8"
                    aria-label="New subtask title"
                  />
                  <Button size="sm" className="h-8" disabled={!newSubtask.trim() || addSubtaskMutation.isPending} onClick={() => addSubtaskMutation.mutate(newSubtask.trim())}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t border-[#f1f1f1] pt-3">
                <TagManager entityType="task" entityId={task.id} tags={task.tags || []} />
              </div>

              <div className="flex items-center justify-between border-t border-[#f1f1f1] pt-3">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
                {onOpenFullPage && (
                  <Button variant="outline" size="sm" onClick={() => onOpenFullPage(task)}>
                    Open full page <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskSubtaskRow({ subtask, projectStates, onChanged }: { subtask: Task; projectStates: State[]; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const state = subtask.stateId ? projectStates.find((s) => s.id === subtask.stateId) : null;
  const isDone = state?.group === "completed";

  const toggle = async () => {
    const completedState = projectStates.find((s) => s.group === "completed");
    const openState = projectStates.find((s) => s.group !== "completed" && s.group !== "cancelled");
    await api.patch(`/tasks/${subtask.id}`, {
      stateId: isDone ? openState?.id || null : completedState?.id || null,
    });
    queryClient.invalidateQueries({ queryKey: ["task", subtask.parentId || ""] });
    onChanged();
  };

  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
      <Checkbox checked={!!isDone} onCheckedChange={toggle} aria-label={"Toggle " + subtask.title} />
      <span className={cn("min-w-0 flex-1 truncate text-sm", isDone && "text-muted-foreground line-through")}>
        {subtask.title}
      </span>
    </div>
  );
}
