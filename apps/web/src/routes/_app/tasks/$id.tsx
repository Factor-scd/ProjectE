import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, Clock, ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";
import { format, parseISO } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-500",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
  cancelled: "bg-red-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

function TaskDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const { data: task, isLoading } = useApiQuery<Task>(["task", id], "/tasks/" + id);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!task) return <div className="p-8 text-center text-muted-foreground">Task not found</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate({ to: "/tasks" })} className="w-fit">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tasks
      </Button>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-2xl">{task.title}</CardTitle>
            <Badge className={STATUS_COLORS[task.status] || "bg-slate-500"}>{task.status.replace("_", " ")}</Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[task.priority]}>
              {task.priority}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.description && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
              <p className="text-sm whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            {task.dueDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Due: {format(parseISO(task.dueDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {task.estimatedMinutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{task.estimatedMinutes} min</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span>Status: {task.status.replace("_", " ")}</span>
            </div>
          </div>
          {task.tags && task.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((t: any) => (
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
  path: "tasks/$id",
  component: TaskDetail,
});
