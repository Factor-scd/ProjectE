import { useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, formatISO, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { positionForDate, toDayStart, type TimelineTask } from "./gantt-utils";

interface GanttTaskBarProps {
  task: TimelineTask;
  /** Left edge of the bar in timeline pixels. */
  startX: number;
  /** Bar width in timeline pixels (right edge = startX + width). */
  width: number;
  color: string;
  pixelsPerDay: number;
  viewStart: Date;
  onCommit: (taskId: string, dueDate: string) => void;
}

interface DragState {
  startClientX: number;
  origDue: Date;
  lastDue: Date;
  moved: boolean;
}

/**
 * A task bar on the timeline. Tasks only carry an end date (dueDate), so both
 * dragging the body and pulling the right resize handle move the due date; the
 * bar stays anchored at its start (createdAt) date. A task without a due date
 * renders as a small stub that becomes a 1-day bar when dragged.
 */
export function GanttTaskBar({ task, startX, width, color, pixelsPerDay, viewStart, onCommit }: GanttTaskBarProps) {
  const [dragDue, setDragDue] = useState<Date | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const startDate = toDayStart(task.startDate);
  const origDue = task.dueDate ? toDayStart(task.dueDate) : startDate;
  const endDate = dragDue ?? origDue;
  const barWidth = Math.max(positionForDate(endDate, viewStart, pixelsPerDay) - startX, 6);
  const isDone = task.status?.category === "done";
  const isCancelled = task.status?.category === "cancelled";
  const title =
    task.dueDate && task.dueDate !== task.startDate
      ? `${task.title} — due ${format(parseISO(task.dueDate), "MMM d, yyyy")}`
      : task.title;

  const beginDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const initial = task.dueDate ? toDayStart(task.dueDate) : startDate;
    dragRef.current = { startClientX: e.clientX, origDue: initial, lastDue: initial, moved: false };
    setDragDue(initial);

    const onMove = (ev: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const dx = ev.clientX - state.startClientX;
      const days = Math.round(dx / pixelsPerDay);
      let next = addDays(state.origDue, days);
      if (next < startDate) next = startDate;
      state.lastDue = next;
      if (differenceInCalendarDays(next, state.origDue) !== 0) state.moved = true;
      setDragDue(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const state = dragRef.current;
      dragRef.current = null;
      setDragDue(null);
      if (state?.moved) onCommit(task.id, formatISO(state.lastDue));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={beginDrag}
      className={cn(
        "absolute top-1.5 h-6 touch-none select-none overflow-hidden rounded-md px-1.5",
        "text-[11px] font-medium leading-6 text-white shadow-sm",
        "cursor-grab hover:shadow-md active:cursor-grabbing",
        isDone && "opacity-60"
      )}
      style={{
        left: startX,
        width: barWidth,
        backgroundColor: color,
        backgroundImage: isCancelled
          ? "repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.35) 4px 8px)"
          : undefined,
      }}
      title={title}
      aria-label={`${task.title}, drag to change due date`}
    >
      {barWidth >= 30 ? <span className="block truncate">{task.title}</span> : null}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        onPointerDown={beginDrag}
        role="presentation"
      />
    </div>
  );
}