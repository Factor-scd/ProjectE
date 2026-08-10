import { useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { Plus, Pencil, Trash2, FolderKanban, Users, Calendar, ListTodo, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityDetailPanel } from "@/components/entities/entity-detail-panel";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { PROJECT_STATUS, TASK_STATUS } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { Project, Section, Task, PaginatedResponse } from "@/lib/types";

function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const queryClient = useQueryClient();
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
    else createMutation.mutate(data);
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

function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  useRealtime({ enabled: true });

  const activeDomainId = useApiDomain();

  const { data: projectsData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Project>>(
    ["projects", activeDomainId],
    "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  const projects = projectsData?.items || [];

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
        <h1 className="text-2xl font-bold">Projects</h1>
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

      {isLoading ? (
        <LoadingState label="Loading projects..." />
      ) : isError ? (
        <ErrorState message="Failed to load projects." onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to get started." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openProjectDetail(project)}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color || "#3b82f6" }} />
                  <CardTitle className="text-base truncate">{project.name}</CardTitle>
                  <Badge className={cn("ml-auto text-[10px]", PROJECT_STATUS[project.status]?.badge)}>
                    {PROJECT_STATUS[project.status]?.label ?? project.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); openProjectPanel(project); }}
                    aria-label={"Edit " + project.name}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                )}
                <Progress value={project.progress} className="h-1.5 mb-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.completedCount}/{project.taskCount} tasks</span>
                  {project.targetDate && (
                    <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(project.targetDate).toLocaleDateString()}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
                <Progress value={selectedProject.progress} className="h-2 flex-1" />
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
