import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useApiQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TagManager } from "@/components/entities/tag-manager";
import { CustomFieldsDisplay } from "@/components/custom-fields/custom-fields-display";
import { ArrowLeft, Calendar, Clock, ListTodo } from "lucide-react";
import type { Task } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { TASK_STATUS, PRIORITY } from "@/lib/status-colors";

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
            <ListTodo className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-2xl">{task.title}</CardTitle>
            <Badge className={TASK_STATUS[task.status]?.badge}>{TASK_STATUS[task.status]?.label ?? task.status}</Badge>
            <Badge variant="outline" className={PRIORITY[task.priority]?.badge}>
              {PRIORITY[task.priority]?.label ?? task.priority}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {format(parseISO(task.createdAt), "MMM d, yyyy HH:mm")}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {format(parseISO(task.updatedAt), "MMM d, yyyy HH:mm")}</span>
          </div>
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
          <CustomFieldsDisplay entityType="tasks" values={task.customFields} />
          <TagManager entityType="task" entityId={task.id} tags={task.tags || []} />
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
