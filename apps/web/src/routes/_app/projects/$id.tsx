import { useState } from "react";
import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Flag,
  FolderKanban,
  LayoutGrid,
  ListTodo,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useOptimisticPatch } from "@/hooks/use-optimistic-patch";
import { EntityDetailPage } from "@/components/entities/detail-page";
import {
  InlineDate,
  InlineEdit,
  InlineSelect,
  InlineText,
  InlineTextarea,
  type InlineSelectOption,
} from "@/components/entities/inline-edit";
import { EntityActivity } from "@/components/entities/entity-activity";
import { EntityComments } from "@/components/entities/entity-comments";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LoadingState, ErrorState } from "@/components/state";
import { PRIORITY, PROJECT_STATUS } from "@/lib/status-colors";
import type { Cycle, Module, PaginatedResponse, Project, Section, State, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROJECT_STATUS_OPTIONS: InlineSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const SECTION_STATUS_OPTIONS: InlineSelectOption[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];

const MODULE_STATUS_OPTIONS: InlineSelectOption[] = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const MODULE_STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  planned: { label: "Planned", badge: "bg-slate-500 text-white", dot: "bg-slate-400" },
  in_progress: { label: "In Progress", badge: "bg-blue-500 text-white", dot: "bg-blue-500" },
  completed: { label: "Completed", badge: "bg-green-500 text-white", dot: "bg-green-500" },
  cancelled: { label: "Cancelled", badge: "bg-red-500 text-white", dot: "bg-red-400" },
};

const SECTION_STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  planned: { label: "Planned", badge: "bg-slate-500 text-white", dot: "bg-slate-400" },
  in_progress: { label: "In Progress", badge: "bg-blue-500 text-white", dot: "bg-blue-500" },
  complete: { label: "Complete", badge: "bg-green-500 text-white", dot: "bg-green-500" },
};

const NO_SECTION = "__none__";

type PatchFn = (vars: { id: string; data: Record<string, unknown> }) => void;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function targetCountdown(
  targetDate: string | null
): { text: string; className: string } | null {
  if (!targetDate) return null;
  const days = differenceInCalendarDays(parseISO(targetDate), new Date());
  if (days > 0) {
    return {
      text: `${days} ${days === 1 ? "day" : "days"} left`,
      className: "text-muted-foreground",
    };
  }
  if (days === 0) {
    return { text: "Due today", className: "text-muted-foreground" };
  }
  const overdue = Math.abs(days);
  return {
    text: `Overdue by ${overdue} ${overdue === 1 ? "day" : "days"}`,
    className: "text-destructive",
  };
}

function ProjectDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useRealtime({ enabled: true });

  const { data: project, isLoading, isError, error, refetch } = useApiQuery<Project>(
    ["project", id],
    "/projects/" + id
  );

  const { patch } = useOptimisticPatch<Project>({
    entityKey: ["project", id],
    listKeys: [["projects"], ["active-projects"], ["analytics-projects"]],
    patchUrl: (pid) => `/projects/${pid}`,
    applyPatch: (current, data) => ({ ...current, ...data }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingState label="Loading project..." />;
  if (isError) {
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  }
  if (!project) return <ErrorState message="Project not found" />;

  return (
    <EntityDetailPage
      backTo={{ to: "/projects", label: "Back to Projects" }}
      title={
        <InlineText
          value={project.name}
          onSave={(name) => patch({ id, data: { name } })}
          placeholder="Untitled project"
        />
      }
      icon={<FolderKanban className="h-6 w-6" />}
      badges={
        <>
          <InlineSelect
            value={project.status}
            options={PROJECT_STATUS_OPTIONS}
            displayValue={(v) => (
              <Badge className={PROJECT_STATUS[v]?.badge}>
                {PROJECT_STATUS[v]?.label ?? v}
              </Badge>
            )}
            onSave={(status) => patch({ id, data: { status } })}
          />
          <InlineEdit
            value={project.color ?? ""}
            onSave={(color) => patch({ id, data: { color: color || null } })}
            showEditIcon={false}
            title="Edit color"
            display={() => (
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: project.color || "#3b82f6" }}
              />
            )}
            renderEdit={(v, onChange, commit) => (
              <Input
                type="color"
                autoFocus
                className="h-8 w-12"
                value={v || "#3b82f6"}
                onChange={(e) => {
                  onChange(e.target.value);
                  commit(e.target.value);
                }}
              />
            )}
          />
        </>
      }
      actions={
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{project.name}"? This action cannot be
                undone.
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
      }
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: <Overview project={project} patch={patch} />,
        },
        { value: "tasks", label: "Tasks", content: <ProjectTasks project={project} /> },
        { value: "sections", label: "Sections", content: <Sections project={project} /> },
        { value: "modules", label: "Modules", content: <ProjectModules project={project} /> },
        { value: "cycles", label: "Cycles", content: <ProjectCycles project={project} /> },
        {
          value: "activity",
          label: "Activity",
          content: <EntityActivity entityType="project" entityId={id} />,
        },
        {
          value: "comments",
          label: "Comments",
          content: <EntityComments entityType="project" entityId={id} />,
        },
      ]}
    />
  );
}

function Overview({ project, patch }: { project: Project; patch: PatchFn }) {
  const countdown = targetCountdown(project.targetDate);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Description</p>
        <InlineTextarea
          value={project.description ?? ""}
          onSave={(description) =>
            patch({ id: project.id, data: { description: description || null } })
          }
          placeholder="Add a description…"
        />
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Progress</p>
          <span className="ml-auto text-sm font-medium">{project.progress}%</span>
        </div>
        <Progress value={project.progress} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {project.completedCount} of {project.taskCount} tasks done · {project.progress}%
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineDate
            value={project.targetDate}
            onSave={(targetDate) => patch({ id: project.id, data: { targetDate } })}
          />
          {countdown && (
            <span className={cn("text-xs", countdown.className)}>{countdown.text}</span>
          )}
        </div>
      </div>

      {project.tags && project.tags.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <Badge key={t.id} variant="secondary">
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Created {format(parseISO(project.createdAt), "MMM d, yyyy HH:mm")}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated {format(parseISO(project.updatedAt), "MMM d, yyyy HH:mm")}
        </span>
      </div>
    </div>
  );
}

function ProjectTasks({ project }: { project: Project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const sections = project.sections || [];
  const tasks = project.tasks || [];

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", project.id],
    "/states?projectId=" + project.id,
    { enabled: !!project.id }
  );
  const projectStates = statesData?.items || [];
  const completedStateId = projectStates.find((s) => s.group === "completed")?.id;
  const uncompletedStateId = projectStates.find((s) => s.group !== "completed" && s.group !== "cancelled")?.id;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const addMutation = useMutation({
    mutationFn: ({ title, sectionId }: { title: string; sectionId: string | null }) =>
      api.post<Task>("/tasks", {
        title,
        projectId: project.id,
        domain: project.domainId,
        sectionId,
      }),
    onSuccess: () => {
      setNewTitle("");
      toast.success("Task added");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      api.patch<Task>(`/tasks/${taskId}`, { stateId: completed ? completedStateId || null : uncompletedStateId || null }),
    onMutate: (vars) => setPendingId(vars.taskId),
    onSettled: () => setPendingId(null),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submitNewTask = () => {
    const title = newTitle.trim();
    if (!title || addMutation.isPending) return;
    addMutation.mutate({
      title,
      sectionId: sectionId && sectionId !== NO_SECTION ? sectionId : null,
    });
  };

  const sectionIdSet = new Set(sections.map((s) => s.id));
  const tasksBySection = new Map<string, Task[]>();
  const unassigned: Task[] = [];
  for (const task of tasks) {
    if (task.sectionId && sectionIdSet.has(task.sectionId)) {
      const bucket = tasksBySection.get(task.sectionId) ?? [];
      bucket.push(task);
      tasksBySection.set(task.sectionId, bucket);
    } else {
      unassigned.push(task);
    }
  }

  const openTask = (taskId: string) =>
    navigate({ to: "/tasks/$id", params: { id: taskId } });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNewTask();
            }
          }}
          placeholder="New task title…"
          className="h-9"
        />
        <Select value={sectionId} onValueChange={setSectionId}>
          <SelectTrigger className="h-9 w-44" aria-label="Section">
            <SelectValue placeholder="No section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SECTION}>No section</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={submitNewTask}
          disabled={!newTitle.trim() || addMutation.isPending}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No tasks yet — add the first one above.
        </p>
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.id} className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 pb-1">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    SECTION_STATUS[section.status]?.dot ?? "bg-slate-400"
                  )}
                />
                <span className="text-sm font-semibold">{section.name}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {tasksBySection.get(section.id)?.length ?? 0}
                </Badge>
              </div>
              {(tasksBySection.get(section.id) ?? []).map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  pending={pendingId === task.id}
                  projectStates={projectStates}
                  onToggle={(vars) => toggleMutation.mutate(vars)}
                  onOpen={() => openTask(task.id)}
                />
              ))}
            </div>
          ))}
          {unassigned.length > 0 ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 pb-1">
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                <span className="text-sm font-semibold text-muted-foreground">
                  Unassigned
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {unassigned.length}
                </Badge>
              </div>
              {unassigned.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  pending={pendingId === task.id}
                  projectStates={projectStates}
                  onToggle={(vars) => toggleMutation.mutate(vars)}
                  onOpen={() => openTask(task.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  pending,
  projectStates,
  onToggle,
  onOpen,
}: {
  task: Task;
  pending: boolean;
  projectStates: State[];
  onToggle: (vars: { taskId: string; completed: boolean }) => void;
  onOpen: () => void;
}) {
  const state = task.stateId ? projectStates.find((s) => s.id === task.stateId) : null;
  const isCompleted = state?.group === "completed";

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <Checkbox
        checked={isCompleted}
        disabled={pending}
        onCheckedChange={() =>
          onToggle({
            taskId: task.id,
            completed: isCompleted,
          })
        }
        aria-label={
          "Mark " + task.title + " " + (isCompleted ? "as not done" : "as done")
        }
      />
      {state ? (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: state.color || "#94a3b8" }} />
      ) : (
        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
      )}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-sm hover:underline",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </button>
      <Badge variant="outline" className={cn("text-[10px]", PRIORITY[task.priority]?.badge)}>
        {PRIORITY[task.priority]?.label ?? task.priority}
      </Badge>
      {task.dueDate ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(parseISO(task.dueDate), "MMM d")}
        </span>
      ) : null}
    </div>
  );
}

function Sections({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [kind, setKind] = useState<"section" | "milestone">("section");

  const sections = project.sections || [];
  const tasks = project.tasks || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["project", project.id] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const addMutation = useMutation({
    mutationFn: ({ name, kind }: { name: string; kind: "section" | "milestone" }) =>
      api.post<Section>(`/projects/${project.id}/sections`, { name, kind }),
    onSuccess: () => {
      setNewName("");
      toast.success("Section added");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const renameMutation = useMutation({
    mutationFn: ({ sid, name }: { sid: string; name: string }) =>
      api.patch<Section>(`/projects/${project.id}/sections/${sid}`, { name }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ sid, status }: { sid: string; status: Section["status"] }) =>
      api.patch<Section>(`/projects/${project.id}/sections/${sid}`, { status }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const dateMutation = useMutation({
    mutationFn: ({ sid, targetDate }: { sid: string; targetDate: string | null }) =>
      api.patch<Section>(`/projects/${project.id}/sections/${sid}`, { targetDate }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (sid: string) => api.delete(`/projects/${project.id}/sections/${sid}`),
    onSuccess: () => {
      toast.success("Section deleted");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submitNewSection = () => {
    const name = newName.trim();
    if (!name || addMutation.isPending) return;
    addMutation.mutate({ name, kind });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitNewSection();
            }
          }}
          placeholder="New section name…"
          className="h-9"
        />
        <ToggleGroup
          type="single"
          size="sm"
          value={kind}
          onValueChange={(v) => {
            if (v) setKind(v as "section" | "milestone");
          }}
        >
          <ToggleGroupItem value="section" aria-label="Section kind">
            Section
          </ToggleGroupItem>
          <ToggleGroupItem value="milestone" aria-label="Milestone kind">
            <Flag className="mr-1 h-3.5 w-3.5" />
            Milestone
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          size="sm"
          onClick={submitNewSection}
          disabled={!newName.trim() || addMutation.isPending}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {sections.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No sections yet.</p>
      ) : (
        <div className="space-y-0.5">
          {sections.map((section) => {
            const taskCount = tasks.filter((t) => t.sectionId === section.id).length;
            return (
              <div
                key={section.id}
                className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
                  {section.kind === "milestone" ? (
                    <>
                      <Flag className="h-3 w-3" /> Milestone
                    </>
                  ) : (
                    "Section"
                  )}
                </Badge>
                <InlineText
                  value={section.name}
                  onSave={(name) => renameMutation.mutate({ sid: section.id, name })}
                  className="text-sm"
                />
                <InlineSelect
                  value={section.status}
                  options={SECTION_STATUS_OPTIONS}
                  displayValue={(v) => (
                    <Badge className={SECTION_STATUS[v]?.badge}>
                      {SECTION_STATUS[v]?.label ?? v}
                    </Badge>
                  )}
                  onSave={(status) =>
                    statusMutation.mutate({
                      sid: section.id,
                      status: status as Section["status"],
                    })
                  }
                />
                <InlineDate
                  value={section.targetDate}
                  onSave={(targetDate) =>
                    dateMutation.mutate({ sid: section.id, targetDate })
                  }
                />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {taskCount} {taskCount === 1 ? "task" : "tasks"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(section.id)}
                  aria-label={"Delete section " + section.name}
                  title="Delete section"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectModules({ project }: { project: Project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const { data: modulesData, isLoading } = useApiQuery<PaginatedResponse<Module>>(
    ["modules", project.id],
    "/projects/" + project.id + "/modules?limit=200"
  );
  const modules = modulesData?.items || [];

  const { data: moduleDetail } = useApiQuery<Module & { tasks: Task[] }>(
    ["module", selectedModuleId || ""],
    "/projects/" + project.id + "/modules/" + selectedModuleId,
    { enabled: !!selectedModuleId }
  );

  const { data: statesData } = useApiQuery<{ items: State[] }>(
    ["states", project.id],
    "/states?projectId=" + project.id,
    { enabled: !!project.id }
  );
  const projectStates = statesData?.items || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["modules", project.id] });
    if (selectedModuleId) queryClient.invalidateQueries({ queryKey: ["module", selectedModuleId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post<Module>(`/projects/${project.id}/modules`, data),
    onSuccess: () => {
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      toast.success("Module created");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<Module>(`/projects/${project.id}/modules/${id}`, data),
    onSuccess: () => {
      setEditModule(null);
      toast.success("Module updated");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${project.id}/modules/${id}`),
    onSuccess: () => {
      toast.success("Module deleted");
      if (selectedModuleId === editModule?.id) setSelectedModuleId(null);
      setEditModule(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ moduleId, taskId }: { moduleId: string; taskId: string }) =>
      api.post(`/projects/${project.id}/modules/${moduleId}/tasks`, { taskId }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeTaskMutation = useMutation({
    mutationFn: ({ moduleId, taskId }: { moduleId: string; taskId: string }) =>
      api.delete(`/projects/${project.id}/modules/${moduleId}/tasks/${taskId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const tasks = project.tasks || [];
  const moduleTasks = moduleDetail?.tasks || [];
  const moduleTaskIds = new Set(moduleTasks.map((t) => t.id));
  const unassignedTasks = tasks.filter((t) => !t.moduleId && !moduleTaskIds.has(t.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Modules</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Module
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading modules..." />
      ) : modules.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No modules yet. Create one to organize tasks.</p>
      ) : (
        <div className="space-y-2">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className={cn(
                "rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                selectedModuleId === mod.id && "bg-muted/50 ring-1 ring-primary/30"
              )}
              onClick={() => setSelectedModuleId(selectedModuleId === mod.id ? null : mod.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{mod.name}</span>
                  <Badge variant="secondary" className={cn("text-[10px]", MODULE_STATUS[mod.status]?.badge)}>
                    {MODULE_STATUS[mod.status]?.label ?? mod.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditModule(mod); }}>
                    <Flag className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(mod.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {mod.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedModuleId && moduleDetail && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-semibold">Tasks in {moduleDetail.name}</h4>
          {moduleTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks in this module.</p>
          ) : (
            <div className="space-y-1">
              {moduleTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/tasks/$id", params: { id: t.id } })}
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  >
                    {t.title}
                  </button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeTaskMutation.mutate({ moduleId: selectedModuleId, taskId: t.id })}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {unassignedTasks.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Add task:</p>
              <div className="space-y-1">
                {unassignedTasks.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => addTaskMutation.mutate({ moduleId: selectedModuleId, taskId: t.id })}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Module</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Module name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Textarea placeholder="Description (optional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate({ name: newName, description: newDescription || undefined })} disabled={!newName.trim() || createMutation.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editModule} onOpenChange={(o) => { if (!o) setEditModule(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Module</DialogTitle></DialogHeader>
          {editModule && (
            <ModuleEditForm
              module={editModule}
              onSave={(data) => updateMutation.mutate({ id: editModule.id, data })}
              onClose={() => setEditModule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleEditForm({ module: mod, onSave, onClose }: { module: Module; onSave: (data: Record<string, unknown>) => void; onClose: () => void }) {
  const [name, setName] = useState(mod.name);
  const [description, setDescription] = useState(mod.description || "");
  const [status, setStatus] = useState(mod.status);

  return (
    <div className="space-y-4">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      <Select value={status} onValueChange={(v) => setStatus(v as Module["status"])}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {MODULE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ name, description: description || null, status })} disabled={!name.trim()}>Save</Button>
      </div>
    </div>
  );
}

function ProjectCycles({ project }: { project: Project }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCycle, setEditCycle] = useState<Cycle | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  const { data: cyclesData, isLoading } = useApiQuery<{ items: Cycle[] }>(
    ["cycles", project.id],
    "/projects/" + project.id + "/cycles"
  );
  const cycles = cyclesData?.items || [];

  const { data: cycleDetail } = useApiQuery<Cycle & { tasks: Task[] }>(
    ["cycle", selectedCycleId || ""],
    "/projects/" + project.id + "/cycles/" + selectedCycleId,
    { enabled: !!selectedCycleId }
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cycles", project.id] });
    if (selectedCycleId) queryClient.invalidateQueries({ queryKey: ["cycle", selectedCycleId] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<Cycle>(`/projects/${project.id}/cycles`, data),
    onSuccess: () => {
      setCreateOpen(false);
      setNewName("");
      toast.success("Cycle created");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<Cycle>(`/projects/${project.id}/cycles/${id}`, data),
    onSuccess: () => {
      setEditCycle(null);
      toast.success("Cycle updated");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${project.id}/cycles/${id}`),
    onSuccess: () => {
      toast.success("Cycle deleted");
      if (selectedCycleId === editCycle?.id) setSelectedCycleId(null);
      setEditCycle(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const addTaskMutation = useMutation({
    mutationFn: ({ cycleId, taskId }: { cycleId: string; taskId: string }) =>
      api.post(`/projects/${project.id}/cycles/${cycleId}/tasks`, { taskId }),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeTaskMutation = useMutation({
    mutationFn: ({ cycleId, taskId }: { cycleId: string; taskId: string }) =>
      api.delete(`/projects/${project.id}/cycles/${cycleId}/tasks/${taskId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const tasks = project.tasks || [];
  const cycleTasks = cycleDetail?.tasks || [];
  const cycleTaskIds = new Set(cycleTasks.map((t) => t.id));
  const backlogTasks = tasks.filter((t) => !t.cycleId && !cycleTaskIds.has(t.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cycles</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Cycle
        </Button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading cycles..." />
      ) : cycles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No cycles yet. Create a sprint cycle to time-box work.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cycles.map((cycle) => (
            <div
              key={cycle.id}
              className={cn(
                "rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                selectedCycleId === cycle.id && "bg-muted/50 ring-1 ring-primary/30"
              )}
              onClick={() => setSelectedCycleId(selectedCycleId === cycle.id ? null : cycle.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{cycle.name}</span>
                  {cycle.active && <Badge className="text-[10px] bg-green-500 text-white">Active</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditCycle(cycle); }}>
                    <Flag className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(cycle.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                {cycle.startDate && <span>Start: {format(parseISO(cycle.startDate), "MMM d")}</span>}
                {cycle.endDate && <span>End: {format(parseISO(cycle.endDate), "MMM d")}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCycleId && cycleDetail && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="text-sm font-semibold">Tasks in {cycleDetail.name}</h4>
          {cycleTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks in this cycle.</p>
          ) : (
            <div className="space-y-1">
              {cycleTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/tasks/$id", params: { id: t.id } })}
                    className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  >
                    {t.title}
                  </button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeTaskMutation.mutate({ cycleId: selectedCycleId, taskId: t.id })}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {backlogTasks.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Backlog — add task:</p>
              <div className="space-y-1">
                {backlogTasks.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => addTaskMutation.mutate({ cycleId: selectedCycleId, taskId: t.id })}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Cycle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Cycle name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate({ name: newName })} disabled={!newName.trim() || createMutation.isPending}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCycle} onOpenChange={(o) => { if (!o) setEditCycle(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cycle</DialogTitle></DialogHeader>
          {editCycle && (
            <CycleEditForm
              cycle={editCycle}
              onSave={(data) => updateMutation.mutate({ id: editCycle.id, data })}
              onClose={() => setEditCycle(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CycleEditForm({ cycle, onSave, onClose }: { cycle: Cycle; onSave: (data: Record<string, unknown>) => void; onClose: () => void }) {
  const [name, setName] = useState(cycle.name);
  const [startDate, setStartDate] = useState(cycle.startDate ? cycle.startDate.slice(0, 10) : "");
  const [endDate, setEndDate] = useState(cycle.endDate ? cycle.endDate.slice(0, 10) : "");
  const [active, setActive] = useState(cycle.active);

  return (
    <div className="space-y-4">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm text-muted-foreground">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} id="cycle-active" />
        <label htmlFor="cycle-active" className="text-sm cursor-pointer">Active cycle</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave({ name, startDate: startDate ? new Date(startDate).toISOString() : null, endDate: endDate ? new Date(endDate).toISOString() : null, active })} disabled={!name.trim()}>Save</Button>
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "projects/$id",
  component: ProjectDetail,
});
