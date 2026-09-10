import { useState, useMemo } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { Plus, Pencil, Trash2, Calendar, LayoutGrid, List, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EntityDetailPanel } from "@/components/entities/entity-detail-panel";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { PROJECT_STATUS, TASK_STATUS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { Project, Section, Task, PaginatedResponse } from "@/lib/types";

function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [name, setName] = useState(project?.name || "");
  const [description, setDescription] = useState(project?.description || "");
  const [status, setStatus] = useState(project?.status || "active");
  const [color, setColor] = useState(project?.color || "#3b82f6");
  const [targetDate, setTargetDate] = useState(project?.targetDate ? project.targetDate.slice(0, 10) : "");

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<Project>("/projects", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch<Project>("/projects/" + project!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data: any = { name: name.trim(), description: description || null, status, color };
    if (targetDate) data.targetDate = new Date(targetDate).toISOString();
    if (project) updateMutation.mutate(data);
    else createMutation.mutate({ ...data, ...(activeDomainId ? { domain: activeDomainId } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "active" | "paused" | "completed" | "archived")}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="color">Color</Label>
          <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="targetDate">Target Date</Label>
        <Input id="targetDate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {project ? "Update" : "Create"} Project
        </Button>
      </div>
    </form>
  );
}

function ProgressBar({ value, color }: { value: number; color?: string | null }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${value}%`,
          backgroundColor: color || "hsl(var(--primary))",
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  onOpenDetail,
  onOpenPanel,
}: {
  project: Project;
  onOpenDetail: (p: Project) => void;
  onOpenPanel: (p: Project) => void;
}) {
  const status = PROJECT_STATUS[project.status];
  const overdue = project.targetDate && project.status === "active" && new Date(project.targetDate) < new Date();
  return (
    <Card
      className="cursor-pointer rounded-lg border border-[#d9dee7] bg-white shadow-[0_1px_2px_#fafafa] transition-colors hover:bg-[#f7f8fa]"
      onClick={() => onOpenDetail(project)}
    >
      <CardHeader className="pb-1.5">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#1677ff" }} />
          <CardTitle className="truncate text-base">{project.name}</CardTitle>
          <div className="ml-auto flex items-center gap-1.5">
            {status && (
              <Badge variant="secondary" className="font-mono text-[10px] gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                {status.label}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => { e.stopPropagation(); onOpenPanel(project); }}
              aria-label={"Edit " + project.name}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{project.description}</p>
        )}
        <div className="mb-2">
          <ProgressBar value={project.progress} color={project.color} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">{project.completedCount}/{project.taskCount} tasks</span>
          {project.targetDate && (
            <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-destructive" : ""}`}>
              <Calendar className="h-3 w-3" />{new Date(project.targetDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {project.updatedAt && (
          <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" /> Updated {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  useRealtime({ enabled: true });

  useOpenCreateDialog("project", () => setCreateOpen(true));

  const activeDomainId = useApiDomain();

  const projectQueryUrl = () => "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "");

  const { data: projectsData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Project>>(
    ["projects", activeDomainId],
    projectQueryUrl()
  );

  const allProjects = projectsData?.items || [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const projects = useMemo(
    () =>
      allProjects.filter(
        (p) =>
          (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
          (!statusFilter || p.status === statusFilter)
      ),
    [allProjects, search, statusFilter]
  );
  const hasMoreProjects = allProjects.length < (projectsData?.totalItems || 0);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);

  const loadMoreProjects = async () => {
    if (!hasMoreProjects || loadingMoreProjects) return;
    setLoadingMoreProjects(true);
    try {
      const next = await api.get<PaginatedResponse<Project>>(projectQueryUrl() + "&offset=" + projects.length);
      queryClient.setQueryData<PaginatedResponse<Project>>(["projects", activeDomainId], (old) => {
        if (!old) return old;
        const seen = new Set(old.items.map((p) => p.id));
        return { ...old, items: [...old.items, ...next.items.filter((p) => !seen.has(p.id))] };
      });
    } finally {
      setLoadingMoreProjects(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/projects/" + id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); setPanelOpen(false); },
  });

  const openProjectDetail = (project: Project) => {
    navigate({ to: "/projects/$id", params: { id: project.id } });
  };

  const openProjectPanel = async (project: Project) => {
    try {
      const detail = await api.get<Project>("/projects/" + project.id);
      setSelectedProject(detail);
    } catch {
      setSelectedProject(project);
    }
    setPanelOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Projects</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "list")}>
            <TabsList>
              <TabsTrigger value="grid" aria-label="Grid view"><LayoutGrid className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="list" aria-label="List view"><List className="h-4 w-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button aria-label="New project"><Plus className="h-4 w-4 mr-2" />New Project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
              <ProjectForm onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8" aria-label="Search projects" />
        </div>
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-full sm:w-40" aria-label="Filter by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter) && (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSearch(""); setStatusFilter(""); }}>
            Clear
          </Button>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">{projects.length} projects</span>
      </div>

      {isLoading ? (
        <LoadingState label="Loading projects..." />
      ) : isError ? (
        <ErrorState message="Failed to load projects." onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState title={search || statusFilter ? "No matching projects" : "No projects yet"} description={search || statusFilter ? "Try clearing your filters." : "Create your first project to get started."} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#91caff] bg-[#e6f4ff]/40 text-sm font-medium text-[#002c8c] transition-colors hover:bg-[#e6f4ff]"
          >
            <Plus className="h-5 w-5" />
            New project
          </button>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenDetail={openProjectDetail}
              onOpenPanel={openProjectPanel}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {projects.map((project) => {
            const status = PROJECT_STATUS[project.status];
            return (
              <Card
                key={project.id}
                className="cursor-pointer border rounded-lg transition-colors hover:bg-muted/20"
                onClick={() => openProjectDetail(project)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color || "#3b82f6" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{project.name}</span>
                        {status && (
                          <Badge variant="secondary" className="font-mono text-[10px] gap-1.5 shrink-0">
                            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                            {status.label}
                          </Badge>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
                      )}
                    </div>
                    <ProgressBar value={project.progress} color={project.color} />
                    <span className="font-mono text-xs text-muted-foreground shrink-0 w-12 text-right">{project.completedCount}/{project.taskCount}</span>
                    {project.targetDate && (
                      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(project.targetDate).toLocaleDateString()}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={(e) => { e.stopPropagation(); openProjectPanel(project); }}
                      aria-label={"Edit " + project.name}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {hasMoreProjects && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMoreProjects} disabled={loadingMoreProjects}>
            {loadingMoreProjects ? "Loading..." : "Load more projects"}
          </Button>
        </div>
      )}

      <EntityDetailPanel open={panelOpen} onOpenChange={setPanelOpen} title={selectedProject?.name || "Project Details"}>
        {selectedProject && (
          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="tasks" className="flex-1">Tasks</TabsTrigger>
              <TabsTrigger value="sections" className="flex-1">Sections</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <ProgressBar value={selectedProject.progress} color={selectedProject.color} />
                <span className="text-sm font-medium">{selectedProject.progress}%</span>
              </div>
              <ProjectForm project={selectedProject} onClose={() => setPanelOpen(false)} />
              <div className="pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Project</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                      <AlertDialogDescription>Are you sure you want to delete "{selectedProject.name}"?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(selectedProject.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TabsContent>
            <TabsContent value="tasks" className="pt-4">
              <h3 className="font-semibold text-sm mb-2">Tasks ({selectedProject.tasks?.length || 0})</h3>
              {selectedProject.tasks?.length ? (
                <div className="space-y-1">
                  {selectedProject.tasks.map((task: any) => (
                    <div key={task.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <span className="truncate">{task.title}</span>
                      <Badge className={cn("text-[10px] shrink-0", TASK_STATUS[task.status]?.badge)}>{TASK_STATUS[task.status]?.label ?? task.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks in this project.</p>
              )}
            </TabsContent>
            <TabsContent value="sections" className="pt-4">
              <h3 className="font-semibold text-sm mb-2">Sections ({selectedProject.sections?.length || 0})</h3>
              {selectedProject.sections?.length ? (
                <div className="space-y-1">
                  {selectedProject.sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <span className="truncate">{section.name}</span>
                      <Badge variant="outline" className="text-[10px]">{section.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sections yet.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </EntityDetailPanel>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects",
  component: ProjectsPage,
});
