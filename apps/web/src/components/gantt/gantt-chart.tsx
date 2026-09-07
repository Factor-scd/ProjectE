import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay } from "date-fns";
import { api } from "@/lib/api";
import { getStatusColor } from "@/lib/status-colors";
import type { StatusDefinition } from "@/lib/types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/state";
import { GanttTimelineHeader } from "./gantt-timeline-header";
import { GanttTaskBar } from "./gantt-task-bar";
import { GanttMilestone } from "./gantt-milestone";
import { GanttDependencyArrow, type TaskPosition } from "./gantt-dependency-arrow";
import {
  getPixelsPerDay,
  MILESTONE_BAND_HEIGHT,
  positionForDate,
  ROW_HEIGHT,
  TASK_LIST_WIDTH,
  TIMELINE_HEADER_HEIGHT,
  toDayStart,
  type TimelineMilestone,
  type TimelineTask,
  type ZoomLevel,
} from "./gantt-utils";

interface GanttChartProps {
  domainId: string;
  projectId: string;
  tasks: TimelineTask[];
  milestones: TimelineMilestone[];
  /** Fallback lookup when the API's joined status is null. */
  statuses?: StatusDefinition[];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

const GRID_LINE_COLOR = "rgba(148,163,184,0.15)";

export function GanttChart({ projectId, tasks, milestones, statuses }: GanttChartProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const pixelsPerDay = getPixelsPerDay(zoom);

  const resolveStatus = (task: TimelineTask): StatusDefinition | null =>
    task.status ?? statuses?.find((s) => s.id === task.statusId) ?? null;

  const dueMutation = useMutation({
    mutationFn: ({ taskId, dueDate }: { taskId: string; dueDate: string }) =>
      api.patch(`/tasks/${taskId}`, { dueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const { viewStart, viewEnd, totalDays, totalWidth, todayX, taskPositions, rowsHeight } = useMemo(() => {
    const today = startOfDay(new Date());
    const all: Date[] = [today];
    for (const t of tasks) {
      all.push(toDayStart(t.startDate));
      if (t.dueDate) all.push(toDayStart(t.dueDate));
    }
    for (const m of milestones) all.push(toDayStart(m.targetDate));

    const minTime = Math.min(...all.map((d) => d.getTime()));
    const maxTime = Math.max(...all.map((d) => d.getTime()));
    const viewStart = startOfDay(addDays(new Date(minTime), -7));
    const viewEnd = startOfDay(addDays(new Date(maxTime), 7));
    const totalDays = Math.max(differenceInCalendarDays(viewEnd, viewStart) + 1, 7);
    const totalWidth = totalDays * pixelsPerDay;

    const positions = new Map<string, TaskPosition>();
    tasks.forEach((task, i) => {
      const start = toDayStart(task.startDate);
      const end = task.dueDate ? toDayStart(task.dueDate) : start;
      positions.set(task.id, {
        startX: positionForDate(start, viewStart, pixelsPerDay),
        endX: positionForDate(end, viewStart, pixelsPerDay),
        y: i * ROW_HEIGHT + ROW_HEIGHT / 2,
      });
    });

    return {
      viewStart,
      viewEnd,
      totalDays,
      totalWidth,
      todayX: positionForDate(today, viewStart, pixelsPerDay),
      taskPositions: positions,
      rowsHeight: tasks.length * ROW_HEIGHT + MILESTONE_BAND_HEIGHT,
    };
  }, [tasks, milestones, pixelsPerDay]);

  const gridBackground = `repeating-linear-gradient(to right, ${GRID_LINE_COLOR} 0, ${GRID_LINE_COLOR} 1px, transparent 1px, transparent ${pixelsPerDay}px)`;

  const rows: ReactNode[] = tasks.map((task, i) => {
    const pos = taskPositions.get(task.id);
    if (!pos) return null;
    return (
      <div
        key={task.id}
        className="absolute left-0 right-0 border-b border-border/50"
        style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <GanttTaskBar
          task={task}
          startX={pos.startX}
          width={Math.max(pos.endX - pos.startX, 6)}
          color={getStatusColor(resolveStatus(task))}
          pixelsPerDay={pixelsPerDay}
          viewStart={viewStart}
          onCommit={(taskId, dueDate) => dueMutation.mutate({ taskId, dueDate })}
        />
      </div>
    );
  });

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const arrows: ReactNode[] = [];
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const dep = taskById.get(depId);
      if (dep) {
        arrows.push(
          <GanttDependencyArrow
            key={`${task.id}-${depId}`}
            fromTask={dep}
            toTask={task}
            taskPositions={taskPositions}
          />
        );
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          size="sm"
          value={zoom}
          onValueChange={(v) => {
            if (v) setZoom(v as ZoomLevel);
          }}
        >
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
        </ToggleGroup>
        <span className="text-xs text-muted-foreground">
          {format(viewStart, "MMM d")} – {format(addDays(viewStart, totalDays - 1), "MMM d, yyyy")}
        </span>
      </div>

      {tasks.length === 0 && milestones.length === 0 ? (
        <EmptyState
          title="No timeline data"
          description="Add tasks or set a milestone target date to see the Gantt view."
        />
      ) : (
        <div className="overflow-auto rounded-lg border" style={{ maxHeight: "72vh" }}>
          <div className="flex" style={{ width: TASK_LIST_WIDTH + totalWidth }}>
            {/* Fixed task list */}
            <div className="sticky left-0 z-20 shrink-0 border-r bg-background">
              <div
                className="sticky top-0 z-30 flex items-center border-b bg-background px-3 text-xs font-semibold text-muted-foreground"
                style={{ height: TIMELINE_HEADER_HEIGHT }}
              >
                Tasks · {tasks.length}
              </div>
              {tasks.map((task) => (
                <div key={task.id} className="flex h-10 items-center gap-2 border-b px-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: getStatusColor(resolveStatus(task)) }}
                  />
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/tasks/$id", params: { id: task.id } })}
                    className="min-w-0 flex-1 truncate text-left text-xs text-foreground/90 hover:underline"
                    title={task.title}
                  >
                    {task.title}
                  </button>
                </div>
              ))}
              <div
                className="flex items-center border-t px-3 text-xs font-semibold text-muted-foreground"
                style={{ height: MILESTONE_BAND_HEIGHT }}
              >
                Milestones · {milestones.length}
              </div>
            </div>

            {/* Scrollable timeline */}
            <div className="min-w-0 flex-1">
              <div className="sticky top-0 z-10 bg-background">
                <GanttTimelineHeader
                  viewStart={viewStart}
                  viewEnd={addDays(viewStart, totalDays - 1)}
                  zoom={zoom}
                  pixelsPerDay={pixelsPerDay}
                />
              </div>
              <div className="relative" style={{ height: rowsHeight }}>
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: gridBackground, backgroundSize: `${pixelsPerDay}px 100%` }}
                />
                {rows}
                <div
                  className="absolute left-0 right-0 border-t border-border/50 bg-muted/20"
                  style={{ top: tasks.length * ROW_HEIGHT, height: MILESTONE_BAND_HEIGHT }}
                >
                  {milestones.map((m) => (
                    <GanttMilestone
                      key={m.id}
                      milestone={m}
                      x={positionForDate(m.targetDate, viewStart, pixelsPerDay) - 8}
                    />
                  ))}
                </div>
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-10"
                  width={totalWidth}
                  height={rowsHeight}
                >
                  <defs>
                    <marker
                      id="gantt-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                    </marker>
                  </defs>
                  <line
                    x1={todayX + 0.5}
                    y1={0}
                    x2={todayX + 0.5}
                    y2={rowsHeight}
                    className="stroke-red-500"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  {arrows}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}