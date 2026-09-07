import type { TimelineTask } from "./gantt-utils";

export interface TaskPosition {
  /** Left edge of the task's bar in timeline pixels. */
  startX: number;
  /** Right edge of the task's bar in timeline pixels. */
  endX: number;
  /** Vertical center of the task's row in pixels. */
  y: number;
}

interface GanttDependencyArrowProps {
  /** The task being depended on (arrow originates at the end of its bar). */
  fromTask: TimelineTask;
  /** The blocked task (arrowhead lands at the start of its bar). */
  toTask: TimelineTask;
  taskPositions: ReadonlyMap<string, TaskPosition>;
}

const BEND = 12;

/**
 * SVG elbow arrow from the end of the blocking task's bar to the start of the
 * blocked task's bar. Rendered inside the chart's overlay <svg> — the marker
 * is defined there under the id `gantt-arrow`.
 */
export function GanttDependencyArrow({ fromTask, toTask, taskPositions }: GanttDependencyArrowProps) {
  const from = taskPositions.get(fromTask.id);
  const to = taskPositions.get(toTask.id);
  if (!from || !to) return null;

  const x1 = from.endX;
  const y1 = from.y;
  // If the target bar starts before the source ends, drop the arrowhead just
  // past the source end so the elbow path never doubles back on itself.
  const x2 = Math.max(to.startX, from.endX + BEND);
  const y2 = to.y;
  const d = `M ${x1} ${y1} H ${x1 + BEND} L ${x2 - BEND} ${y2} H ${x2}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      markerEnd="url(#gantt-arrow)"
      className="text-muted-foreground/70"
    />
  );
}