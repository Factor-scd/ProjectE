import { useState } from "react";
import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Link2,
  ListTodo,
  Plus,
  RepeatIcon,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOptimisticPatch } from "@/hooks/use-optimistic-patch";
import { EntityDetailPage } from "@/components/entities/detail-page";
import {
  InlineDate,
  InlineSelect,
  InlineText,
  InlineTextarea,
  type InlineSelectOption,
} from "@/components/entities/inline-edit";
import { EntityActivity } from "@/components/entities/entity-activity";
import { EntityComments } from "@/components/entities/entity-comments";
import { TagManager } from "@/components/entities/tag-manager";
import { CustomFieldsDisplay } from "@/components/custom-fields/custom-fields-display";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, ErrorState } from "@/components/state";
import { PRIORITY } from "@/lib/status-colors";
import type { PaginatedResponse, Project, State, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS: InlineSelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const ESTIMATE_OPTIONS: InlineSelectOption[] = [
  { value: "", label: "None" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "90", label: "90 min" },
  { value: "120", label: "120 min" },
];

// Query keys to keep fresh after any task-affecting mutation. Mirrors the
// realtime hook's invalidation so list/analytics views never go stale.
const LIST_KEYS: string[][] = [
  ["tasks"],
  ["tasks-due"],
  ["stats"],
  ["productivity-chart"],
  ["analytics-daily"],
  ["analytics-projects"],
];

type PatchFn = (vars: { id: string; data: Record<string, unknown> }) => void;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function TaskDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtime({ enabled: true });

  const { data: task, isLoading, isError, error, refetch } = useApiQuery<Task>(
    ["task", id],
    "/tasks/" + id
  );

  const { patch } = useOptimisticPatch<Task>({
    entityKey: ["task", id],
    listKeys: LIST_KEYS,
    patchUrl: (taskId) => `/tasks/${taskId}`,
    applyPatch: (current, data) => ({ ...current, ...data }),
  });

  const toggleComplete = useMutation({
    mutationFn: () => {
      const completedStates = projectStates.filter((s) => s.group === "completed");
      const uncompletedStates = projectStates.filter((s) => s.group !== "completed");
      const isDone = task?.status === "done";
      if (isDone && uncompletedStates.length > 0) {
        return api.patch<Task>(`/tasks/${id}`, { stateId: uncompletedStates[0].id });
      } else if (!isDone && completedStates.length > 0) {
        return api.patch<Task>(`/tasks/${id}`, { stateId: completedStates[0].id });
      }
      return api.patch<Task>(`/tasks/${id}`, { stateId: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", id] });
      for (const key of LIST_KEYS) queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", task?.projectId || ""],
    "/states?projectId=" + (task?.projectId || ""),
    { enabled: !!task?.projectId }
  );
  const projectStates = statesData?.items || [];
  const currentState = task?.stateId ? projectStates.find((s) => s.id === task.stateId) : null;

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
      navigate({ to: "/tasks" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingState label="Loading task..." />;
  if (isError) {
    return (
      <ErrorState
        message={errorMessage(error)}
        onRetry={() => refetch()}
      />
    );
  }
  if (!task) return <ErrorState message="Task not found" />;

  const isDone = currentState?.group === "completed";

  return (
    <EntityDetailPage
      backTo={{ to: "/tasks", label: "Back to Tasks" }}
      title={
        <InlineText
          value={task.title}
          onSave={(title) => patch({ id, data: { title } })}
          placeholder="Untitled task"
        />
      }
      icon={<ListTodo className="h-6 w-6" />}
      badges={
        <>
          {projectStates.length > 0 ? (
            <InlineSelect
              value={task.stateId ?? ""}
              options={projectStates.map((s) => ({ value: s.id, label: s.name }))}
              displayValue={(v) => {
                if (!v) return <Badge variant="secondary">No state</Badge>;
                const st = projectStates.find((s) => s.id === v);
                if (!st) return <Badge variant="secondary">Unknown</Badge>;
                return (
                  <Badge variant="secondary" className="gap-1" style={st.color ? { backgroundColor: st.color + "20", color: st.color } : undefined}>
                    <span className="h-1.5 w-1.5 rounded-full" style={st.color ? { backgroundColor: st.color } : undefined} />
                    {st.name}
                  </Badge>
                );
              }}
              onSave={(stateId) => patch({ id, data: { stateId: stateId || null } })}
            />
          ) : (
            <Badge variant="secondary">
              {currentState?.name || task.status.replace("_", " ")}
            </Badge>
          )}
          <InlineSelect
            value={task.priority}
            options={PRIORITY_OPTIONS}
            displayValue={(v) => (
              <Badge variant="outline" className={PRIORITY[v]?.badge}>
                {PRIORITY[v]?.label ?? v}
              </Badge>
            )}
            onSave={(priority) => patch({ id, data: { priority } })}
          />
        </>
      }
      actions={
        <>
          <Button
            onClick={() => toggleComplete.mutate()}
            disabled={toggleComplete.isPending}
          >
            {isDone ? (
              <>
                <RotateCcw className="h-4 w-4" /> Reopen
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Complete
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Task</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{task.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
      tabs={[
        { value: "overview", label: "Overview", content: <Overview task={task} patch={patch} /> },
        { value: "subtasks", label: "Subtasks", content: <Subtasks task={task} /> },
        { value: "dependencies", label: "Dependencies", content: <Dependencies task={task} /> },
        {
          value: "activity",
          label: "Activity",
          content: <EntityActivity entityType="task" entityId={id} />,
        },
        {
          value: "comments",
          label: "Comments",
          content: <EntityComments entityType="task" entityId={id} />,
        },
      ]}
    />
  );
}

function Overview({ task, patch }: { task: Task; patch: PatchFn }) {
  const navigate = useNavigate();
  const activeDomainId = useApiDomain();
  const { data: projectsData } = useApiQuery<PaginatedResponse<Project>>(
    ["projects", activeDomainId],
    "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  const projects = projectsData?.items ?? [];
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const projectOptions: InlineSelectOption[] = [
    { value: "", label: "No project" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", task.projectId || ""],
    "/states?projectId=" + (task.projectId || ""),
    { enabled: !!task.projectId }
  );
  const projectStates = statesData?.items || [];

  const stateOptions: InlineSelectOption[] = [
    { value: "", label: "No state" },
    ...projectStates.map((s) => ({ value: s.id, label: s.name })),
  ];

  const currentState = task.stateId ? projectStates.find((s) => s.id === task.stateId) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Description</p>
        <InlineTextarea
          value={task.description ?? ""}
          onSave={(description) =>
            patch({ id: task.id, data: { description: description || null } })
          }
          placeholder="Add a description…"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineDate
            value={task.dueDate}
            onSave={(dueDate) => patch({ id: task.id, data: { dueDate } })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineSelect
            value={task.estimatedMinutes !== null ? String(task.estimatedMinutes) : ""}
            options={ESTIMATE_OPTIONS}
            displayValue={(v) =>
              v ? (
                <span>{v} min</span>
              ) : (
                <span className="text-muted-foreground/70">No estimate</span>
              )
            }
            onSave={(est) =>
              patch({ id: task.id, data: { estimatedMinutes: est ? Number(est) : null } })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineSelect
            value={task.projectId ?? ""}
            options={projectOptions}
            displayValue={(v) =>
              v ? (
                <a
                  href={`/projects/${v}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate({ to: "/projects/$id", params: { id: v } });
                  }}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {projectNameById.get(v) ?? "Unknown project"}
                </a>
              ) : (
                <span className="text-muted-foreground/70">No project</span>
              )
            }
            onSave={(projectId) =>
              patch({ id: task.id, data: { projectId: projectId || null } })
            }
          />
        </div>
        {projectStates.length > 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <InlineSelect
              value={task.stateId ?? ""}
              options={stateOptions}
              displayValue={(v) => {
                if (!v) return <span className="text-muted-foreground/70">No state</span>;
                const st = projectStates.find((s) => s.id === v);
                if (!st) return <span>{v}</span>;
                return (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: st.color || "#94a3b8" }} />
                    {st.name}
                  </span>
                );
              }}
              onSave={(stateId) =>
                patch({ id: task.id, data: { stateId: stateId || null } })
              }
            />
          </div>
        )}
        {task.recurrenceRule ? (
          <div className="flex items-center gap-2">
            <RepeatIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{task.recurrenceRule}</span>
          </div>
        ) : null}
      </div>

      <div className="border-t pt-4">
        <TagManager entityType="task" entityId={task.id} tags={task.tags || []} />
      </div>

      <CustomFieldsDisplay entityType="tasks" values={task.customFields} />

      <div className="flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Created {format(parseISO(task.createdAt), "MMM d, yyyy HH:mm")}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated {format(parseISO(task.updatedAt), "MMM d, yyyy HH:mm")}
        </span>
      </div>
    </div>
  );
}

function Subtasks({ task }: { task: Task }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const addMutation = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>("/tasks", { title, parentId: task.id, domain: task.domainId }),
    onSuccess: () => {
      setNewTitle("");
      toast.success("Subtask added");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ subId, completed }: { subId: string; completed: boolean }) =>
      api.patch<Task>(`/tasks/${subId}`, { stateId: completed ? null : null }),
    onMutate: (vars) => setPendingId(vars.subId),
    onSettled: () => setPendingId(null),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const subtasks = task.subtasks || [];

  const submitNewSubtask = () => {
    const title = newTitle.trim();
    if (!title || addMutation.isPending) return;
    addMutation.mutate(title);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNewSubtask();
            }
          }}
          placeholder="New subtask title…"
          className="h-9"
        />
        <Button size="sm" onClick={submitNewSubtask} disabled={!newTitle.trim() || addMutation.isPending}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {subtasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No subtasks yet.</p>
      ) : (
        <div className="space-y-0.5">
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                checked={sub.status === "done"}
                disabled={pendingId === sub.id}
                onCheckedChange={() =>
                  toggleMutation.mutate({
                    subId: sub.id,
                    completed: sub.status === "done",
                  })
                }
                aria-label={"Mark " + sub.title + " " + (sub.status === "done" ? "as not done" : "as done")}
              />
              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
              <button
                type="button"
                onClick={() => navigate({ to: "/tasks/$id", params: { id: sub.id } })}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm hover:underline",
                  sub.status === "done" && "text-muted-foreground line-through"
                )}
              >
                {sub.title}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dependencies({ task }: { task: Task }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [targetEntityId, setTargetEntityId] = useState("");
  const [linkType, setLinkType] = useState<string>("blocks");

  const { data: linksData, isLoading: linksLoading } = useApiQuery<{ items: import("@/lib/types").Link[] }>(
    ["links", "task", task.id],
    "/links?entityType=task&entityId=" + task.id
  );

  const { data: tasksData, isLoading: tasksLoading } = useApiQuery<PaginatedResponse<Task>>(
    ["tasks", activeDomainId, "dependency-picker"],
    "/tasks?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["links", "task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const addLink = useMutation({
    mutationFn: (vars: { sourceId: string; targetId: string; linkType: string }) =>
      api.post("/links", {
        sourceType: "task",
        sourceId: vars.sourceId,
        targetType: "task",
        targetId: vars.targetId,
        linkType: vars.linkType,
      }),
    onSuccess: () => {
      setTargetEntityId("");
      toast.success("Link added");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeLink = useMutation({
    mutationFn: (linkId: string) => api.delete(`/links/${linkId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const links = linksData?.items || [];

  const incomingLinks = links.filter((l) => l.targetId === task.id && l.sourceType === "task");
  const outgoingLinks = links.filter((l) => l.sourceId === task.id && l.targetType === "task");

  const allTaskIds = new Set((tasksData?.items || []).map((t) => t.id));
  const linkedTaskIds = new Set([...incomingLinks.map((l) => l.sourceId), ...outgoingLinks.map((l) => l.targetId), task.id]);
  const availableTasks = (tasksData?.items || []).filter(
    (t) => t.id !== task.id && !linkedTaskIds.has(t.id)
  );
  const depPlaceholder = tasksLoading
    ? "Loading tasks..."
    : availableTasks.length === 0
      ? "No tasks to add"
      : "Add link...";

  const taskTitleById = new Map((tasksData?.items || []).map((t) => [t.id, t.title]));

  const handleAddLink = (value: string) => {
    if (!value) return;
    addLink.mutate({ sourceId: task.id, targetId: value, linkType });
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Links to this task
        </h3>
        {incomingLinks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No incoming links.</p>
        ) : (
          <div className="space-y-0.5">
            {incomingLinks.map((link) => (
              <div
                key={link.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => navigate({ to: "/tasks/$id", params: { id: link.sourceId } })}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                >
                  {taskTitleById.get(link.sourceId) || link.sourceId}
                </button>
                <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLink.mutate(link.id)}
                  aria-label="Remove link"
                  title="Remove link"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          Links from this task
        </h3>
        {outgoingLinks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No outgoing links.</p>
        ) : (
          <div className="space-y-0.5">
            {outgoingLinks.map((link) => (
              <div
                key={link.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => navigate({ to: "/tasks/$id", params: { id: link.targetId } })}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                >
                  {taskTitleById.get(link.targetId) || link.targetId}
                </button>
                <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLink.mutate(link.id)}
                  aria-label="Remove link"
                  title="Remove link"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Select value={linkType} onValueChange={setLinkType}>
            <SelectTrigger className="h-8 w-32 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blocks">Blocks</SelectItem>
              <SelectItem value="relates">Relates to</SelectItem>
              <SelectItem value="parent-child">Parent/Child</SelectItem>
              <SelectItem value="created-from">Created from</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={targetEntityId}
            onValueChange={handleAddLink}
            disabled={availableTasks.length === 0}
          >
            <SelectTrigger className="h-8 flex-1 text-sm" aria-label="Add link">
              <SelectValue placeholder={depPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {availableTasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "tasks/$id",
  component: TaskDetail,
});
