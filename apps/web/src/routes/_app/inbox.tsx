import { useMemo } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { Inbox as InboxIcon, AlertTriangle, CalendarClock, Flame, FileText, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/state";
import { cn } from "@/lib/utils";
import type { Task, Habit, Note, PaginatedResponse } from "@/lib/types";
import { format, isToday, isPast, parseISO } from "date-fns";

function InboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";

  useRealtime({ enabled: true });

  // ─── Queries ──────────────────────────────────────────────────────────
  const { data: tasksData, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } =
    useApiQuery<PaginatedResponse<Task>>(
      ["tasks-inbox", activeDomainId],
      "/tasks?limit=200&status=todo,in_progress&sort=due_date" + domainSuffix,
    );

  const { data: habitsData, isLoading: habitsLoading, error: habitsError, refetch: refetchHabits } =
    useApiQuery<PaginatedResponse<Habit>>(
      ["habits-inbox", activeDomainId],
      "/habits?limit=50" + domainSuffix,
    );

  const { data: notesData, isLoading: notesLoading, error: notesError, refetch: refetchNotes } =
    useApiQuery<PaginatedResponse<Note>>(
      ["notes-inbox", activeDomainId],
      "/notes?limit=5&sort=-updated" + domainSuffix,
    );

  // ─── Filtering ────────────────────────────────────────────────────────
  const tasks = tasksData?.items || [];
  const today = new Date();

  const overdueTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.dueDate) return false;
        const d = parseISO(t.dueDate);
        return isPast(d) && !isToday(d);
      }),
    [tasks],
  );

  const dueTodayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate && isToday(parseISO(t.dueDate))),
    [tasks],
  );

  const habits = habitsData?.items || [];
  const notes = notesData?.items || [];

  // ─── Mutations ────────────────────────────────────────────────────────
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.patch<Task>("/tasks/" + taskId, { status: "done" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks-inbox"] }),
  });

  const completeHabitMutation = useMutation({
    mutationFn: (habitId: string) => api.post("/habits/" + habitId + "/complete", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["habits-inbox"] }),
  });

  const isLoading = tasksLoading || habitsLoading || notesLoading;
  const hasError = tasksError || habitsError || notesError;

  if (isLoading) return <LoadingState label="Loading inbox..." />;
  if (hasError) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <InboxIcon className="h-5 w-5" /> Inbox
        </h1>
        <EmptyState icon={AlertTriangle} title="Failed to load inbox" description="Check your connection and try again." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <h1 className="text-xl font-bold flex items-center gap-2">
        <InboxIcon className="h-5 w-5" /> Inbox
      </h1>

      {/* Overdue tasks */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Overdue</h2>
          {overdueTasks.length > 0 && (
            <Badge variant="destructive" className="font-mono text-[10px] px-1.5">{overdueTasks.length}</Badge>
          )}
        </div>
        {overdueTasks.length === 0 ? (
          <div className="py-6 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-muted-foreground">No overdue tasks</p>
          </div>
        ) : (
          <div className="space-y-1">
            {overdueTasks.map((task) => (
              <Card key={task.id} className="border border-destructive/20 hover:bg-muted/20 transition-colors">
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      disabled={completeTaskMutation.isPending}
                      onClick={() => completeTaskMutation.mutate(task.id)}
                      aria-label={"Complete " + task.title}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate({ to: "/tasks/$id", params: { id: task.id } })}
                    >
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-destructive">
                          {format(parseISO(task.dueDate!), "MMM d")}
                        </span>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Due today tasks */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <h2 className="text-sm font-semibold text-amber-500">Due Today</h2>
          {dueTodayTasks.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5">{dueTodayTasks.length}</Badge>
          )}
        </div>
        {dueTodayTasks.length === 0 ? (
          <div className="py-6 text-center">
            <CalendarClock className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No tasks due today</p>
          </div>
        ) : (
          <div className="space-y-1">
            {dueTodayTasks.map((task) => (
              <Card key={task.id} className="border border-amber-500/20 hover:bg-muted/20 transition-colors">
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      disabled={completeTaskMutation.isPending}
                      onClick={() => completeTaskMutation.mutate(task.id)}
                      aria-label={"Complete " + task.title}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate({ to: "/tasks/$id", params: { id: task.id } })}
                    >
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-amber-500">Today</span>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Habits */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-orange-500" />
          <h2 className="text-sm font-semibold text-orange-500">Habits</h2>
          {habits.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5">{habits.length}</Badge>
          )}
        </div>
        {habits.length === 0 ? (
          <div className="py-6 text-center">
            <Flame className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No habits yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {habits.map((habit) => {
              const doneToday = (habit.recentCompletions || []).some((c) => {
                const d = new Date(c.date);
                return (
                  d.getUTCFullYear() === today.getUTCFullYear() &&
                  d.getUTCMonth() === today.getUTCMonth() &&
                  d.getUTCDate() === today.getUTCDate()
                );
              });
              return (
                <Card key={habit.id} className="hover:bg-muted/20 transition-colors">
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        className={cn(
                          "w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors",
                          doneToday
                            ? "bg-green-500 border-green-500"
                            : "border-muted-foreground/30 hover:border-primary",
                        )}
                        disabled={completeHabitMutation.isPending}
                        onClick={() => completeHabitMutation.mutate(habit.id)}
                        aria-label={doneToday ? habit.name + " (completed)" : "Complete " + habit.name}
                      >
                        {doneToday && <Check className="h-3 w-3 text-white" />}
                      </button>
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate({ to: "/habits/$id", params: { id: habit.id } })}
                      >
                        <p className={cn("text-sm font-medium truncate", doneToday && "line-through text-muted-foreground")}>
                          {habit.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{habit.frequency}</span>
                          {habit.streakCount > 0 && (
                            <Badge variant="secondary" className="font-mono text-[10px] px-1">
                              <Flame className="h-2.5 w-2.5 mr-0.5 text-orange-500" />
                              {habit.streakCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent notes */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-blue-500">Recent Notes</h2>
        </div>
        {notes.length === 0 ? (
          <div className="py-6 text-center">
            <FileText className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No notes yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notes.map((note) => (
              <Card
                key={note.id}
                className="hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => navigate({ to: "/notes/$id", params: { id: note.id } })}
              >
                <CardContent className="p-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{note.title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {format(parseISO(note.updatedAt), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/inbox",
  component: InboxPage,
});
