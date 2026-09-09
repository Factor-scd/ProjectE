import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { parseTaskInput } from "@/lib/nlp";
import { toast } from "sonner";
import {
  Inbox as InboxIcon,
  AlertTriangle,
  CalendarClock,
  Flame,
  FileText,
  Check,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, EmptyState } from "@/components/state";
import { cn } from "@/lib/utils";
import type { Task, Habit, Note, PaginatedResponse } from "@/lib/types";
import { format, isToday, isPast, parseISO } from "date-fns";

// ─── Flat item type for keyboard navigation ──────────────────────────────
interface FlatItem {
  kind: "task-overdue" | "task-today" | "habit" | "note";
  id: string;
  title: string;
  route: string;
}

function InboxPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";

  // ─── Quick capture state ───────────────────────────────────────────────
  const [quickInput, setQuickInput] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const isInputFocused = useRef(false);

  useRealtime({ enabled: true });

  // ─── Queries ──────────────────────────────────────────────────────────
  const {
    data: tasksData,
    isLoading: tasksLoading,
    error: tasksError,
  } = useApiQuery<PaginatedResponse<Task>>(
    ["tasks-inbox", activeDomainId],
    "/tasks?limit=200&status=todo,in_progress&sort=due_date" + domainSuffix,
  );

  const {
    data: habitsData,
    isLoading: habitsLoading,
    error: habitsError,
  } = useApiQuery<PaginatedResponse<Habit>>(
    ["habits-inbox", activeDomainId],
    "/habits?limit=50" + domainSuffix,
  );

  const {
    data: notesData,
    isLoading: notesLoading,
    error: notesError,
  } = useApiQuery<PaginatedResponse<Note>>(
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

  // ─── Flat list for keyboard nav ───────────────────────────────────────
  const allItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const t of overdueTasks) {
      items.push({ kind: "task-overdue", id: t.id, title: t.title, route: `/tasks/${t.id}` });
    }
    for (const t of dueTodayTasks) {
      items.push({ kind: "task-today", id: t.id, title: t.title, route: `/tasks/${t.id}` });
    }
    for (const h of habits) {
      items.push({ kind: "habit", id: h.id, title: h.name, route: `/habits/${h.id}` });
    }
    for (const n of notes) {
      items.push({ kind: "note", id: n.id, title: n.title, route: `/notes/${n.id}` });
    }
    return items;
  }, [overdueTasks, dueTodayTasks, habits, notes]);

  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ─── Keyboard navigation ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setSelectedRowIndex((prev) => Math.min(prev + 1, allItems.length - 1));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setSelectedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && selectedRowIndex >= 0 && selectedRowIndex < allItems.length) {
        e.preventDefault();
        navigate({ to: allItems[selectedRowIndex].route });
      } else if (e.key === "Escape") {
        setSelectedRowIndex(-1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [allItems, selectedRowIndex, navigate]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRowIndex >= 0) {
      const el = rowRefs.current.get(selectedRowIndex);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedRowIndex]);

  // ─── Input-focus guard ────────────────────────────────────────────────
  useEffect(() => {
    const onFocus = () => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      isInputFocused.current = tag === "INPUT" || tag === "TEXTAREA";
    };
    const onBlur = () => {
      // Small delay so the new focus target is set first
      setTimeout(() => {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        isInputFocused.current = tag === "INPUT" || tag === "TEXTAREA";
      }, 0);
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  // ─── Quick capture ────────────────────────────────────────────────────
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => api.post("/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleQuickCapture = () => {
    if (!quickInput.trim()) return;
    const parsed = parseTaskInput(quickInput);
    const data: Record<string, any> = {
      title: parsed.title,
      priority: parsed.priority || "medium",
    };
    if (parsed.dueDate) data.dueDate = parsed.dueDate;
    if (parsed.tags.length) data.tagNames = parsed.tags;
    if (activeDomainId) data.domain = activeDomainId;
    createTaskMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Task created");
        setQuickInput("");
      },
      onError: () => toast.error("Failed to create task"),
    });
  };

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
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load inbox"
          description="Check your connection and try again."
        />
      </div>
    );
  }

  // Helper: get flat index for an item
  const flatIndex = (kind: FlatItem["kind"], id: string) =>
    allItems.findIndex((i) => i.kind === kind && i.id === id);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <h1 className="text-xl font-bold flex items-center gap-2">
        <InboxIcon className="h-5 w-5" /> Inbox
      </h1>

      {/* Quick capture input */}
      <div className="flex gap-2">
        <Input
          ref={quickInputRef}
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleQuickCapture();
            }
          }}
          placeholder='Quick task — e.g. "Call dentist tomorrow #health"'
          className="flex-1"
        />
        <Button
          size="sm"
          disabled={!quickInput.trim() || createTaskMutation.isPending}
          onClick={handleQuickCapture}
        >
          Add
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-[10px] text-muted-foreground -mt-2">
        Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">j</kbd>/
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">k</kbd> to
        navigate, <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> to
        open
      </p>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Overdue</h2>
            <Badge variant="destructive" className="font-mono text-[10px] px-1.5">
              {overdueTasks.length}
            </Badge>
          </div>
          <div className="space-y-1">
            {overdueTasks.map((task) => {
              const idx = flatIndex("task-overdue", task.id);
              return (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                  }}
                >
                  <Card
                    className={cn(
                      "border border-destructive/20 hover:bg-muted/20 transition-colors",
                      selectedRowIndex === idx && "ring-2 ring-primary/50 bg-muted/30",
                    )}
                  >
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
                          onClick={() =>
                            navigate({ to: "/tasks/$id", params: { id: task.id } })
                          }
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Due today tasks */}
      {dueTodayTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <h2 className="text-sm font-semibold text-amber-500">Due Today</h2>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
              {dueTodayTasks.length}
            </Badge>
          </div>
          <div className="space-y-1">
            {dueTodayTasks.map((task) => {
              const idx = flatIndex("task-today", task.id);
              return (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                  }}
                >
                  <Card
                    className={cn(
                      "border border-amber-500/20 hover:bg-muted/20 transition-colors",
                      selectedRowIndex === idx && "ring-2 ring-primary/50 bg-muted/30",
                    )}
                  >
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
                          onClick={() =>
                            navigate({ to: "/tasks/$id", params: { id: task.id } })
                          }
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Habits */}
      {habits.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <h2 className="text-sm font-semibold text-orange-500">Habits</h2>
            <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
              {habits.length}
            </Badge>
          </div>
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
              const idx = flatIndex("habit", habit.id);
              return (
                <div
                  key={habit.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                  }}
                >
                  <Card
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      selectedRowIndex === idx && "ring-2 ring-primary/50 bg-muted/30",
                    )}
                  >
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
                          aria-label={
                            doneToday ? habit.name + " (completed)" : "Complete " + habit.name
                          }
                        >
                          {doneToday && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() =>
                            navigate({ to: "/habits/$id", params: { id: habit.id } })
                          }
                        >
                          <p
                            className={cn(
                              "text-sm font-medium truncate",
                              doneToday && "line-through text-muted-foreground",
                            )}
                          >
                            {habit.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {habit.frequency}
                            </span>
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent notes */}
      {notes.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-sm font-semibold text-blue-500">Recent Notes</h2>
          </div>
          <div className="space-y-1">
            {notes.map((note) => {
              const idx = flatIndex("note", note.id);
              return (
                <div
                  key={note.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(idx, el);
                  }}
                >
                  <Card
                    className={cn(
                      "hover:bg-muted/20 transition-colors cursor-pointer",
                      selectedRowIndex === idx && "ring-2 ring-primary/50 bg-muted/30",
                    )}
                    onClick={() =>
                      navigate({ to: "/notes/$id", params: { id: note.id } })
                    }
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
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {allItems.length === 0 && !isLoading && (
        <div className="py-12 text-center">
          <InboxIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Inbox is clear</p>
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/inbox",
  component: InboxPage,
});
