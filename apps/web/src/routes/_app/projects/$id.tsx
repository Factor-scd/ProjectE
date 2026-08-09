import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, ListTodo, Activity } from "lucide-react";
import type { Project } from "@/lib/types";
import { format, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  paused: "bg-amber-500",
  completed: "bg-blue-500",
  archived: "bg-slate-500",
};

function ProjectDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: project, isLoading } = useApiQuery<Project>(["project", id], "/projects/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!project) return <div className="p-8 text-center text-muted-foreground">Project not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/projects" })} className="w-fit">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color || "#3b82f6" }} />
            <CardTitle className="text-2xl">{project.name}</CardTitle>
            <Badge className={STATUS_COLORS[project.status] || "bg-slate-500"}>{project.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.description && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span>{project.taskCount} tasks ({project.completedCount} done)</span>
            </div>
            {project.targetDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Target: {format(parseISO(project.targetDate), "MMM d, yyyy")}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>{project.progress}% complete</span>
            </div>
          </div>
          <Progress value={project.progress} className="h-2" />
          {project.tags && project.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((t: any) => (
                  <Badge key={t.id || t.name} variant="secondary">{t.name || t}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "projects/$id",
  component: ProjectDetail,
});
