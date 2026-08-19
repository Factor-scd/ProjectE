import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getDateRange,
  positionForDate,
  TIMELINE_HEADER_HEIGHT,
  type ZoomLevel,
} from "./gantt-utils";

interface GanttTimelineHeaderProps {
  viewStart: Date;
  viewEnd: Date;
  zoom: ZoomLevel;
  pixelsPerDay: number;
}

function cellWidth(cell: Date, zoom: ZoomLevel, pixelsPerDay: number): number {
  switch (zoom) {
    case "day":
      return pixelsPerDay;
    case "week":
      return 7 * pixelsPerDay;
    case "month":
      return getDaysInMonth(cell) * pixelsPerDay;
  }
}

/**
 * Two-row date header: a group label row (months for day/week zoom, years for
 * month zoom) above the per-column cells. Positioned absolutely inside a
 * container that spans the full timeline width so it can be made sticky by the
 * parent chart.
 */
export function GanttTimelineHeader({ viewStart, viewEnd, zoom, pixelsPerDay }: GanttTimelineHeaderProps) {
  const cells = getDateRange(viewStart, viewEnd, zoom);

  // Group consecutive cells into spans for the top row.
  const groups: { key: string; label: string; start: Date; end: Date }[] = [];
  for (const cell of cells) {
    const key = zoom === "month" ? String(cell.getFullYear()) : format(startOfMonth(cell), "yyyy-MM");
    const label = zoom === "month" ? String(cell.getFullYear()) : format(startOfMonth(cell), "MMMM yyyy");
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.end = cell;
    } else {
      groups.push({ key, label, start: cell, end: cell });
    }
  }

  const renderGroup = (group: { key: string; label: string; start: Date; end: Date }) => {
    const left = positionForDate(group.start, viewStart, pixelsPerDay);
    const width =
      positionForDate(group.end, viewStart, pixelsPerDay) +
      cellWidth(group.end, zoom, pixelsPerDay) -
      left;
    return (
      <div
        key={group.key}
        className="absolute top-0 h-full overflow-hidden px-2 text-[11px] font-semibold leading-6 text-muted-foreground"
        style={{ left, width }}
      >
        {group.label}
      </div>
    );
  };

  const renderCell = (cell: Date) => {
    const left = positionForDate(cell, viewStart, pixelsPerDay);
    const width = cellWidth(cell, zoom, pixelsPerDay);
    const isWeekend = zoom === "day" && (cell.getDay() === 0 || cell.getDay() === 6);
    const label =
      zoom === "day"
        ? format(cell, "EEE d")
        : zoom === "week"
          ? format(cell, "MMM d")
          : format(cell, "MMMM");
    return (
      <div
        key={format(cell, "yyyy-MM-dd")}
        className={cn(
          "absolute top-0 h-full overflow-hidden border-r border-border/60 px-1.5 text-[11px] leading-8",
          isWeekend && "bg-muted/50"
        )}
        style={{ left, width }}
      >
        {label}
      </div>
    );
  };

  return (
    <div className="relative border-b bg-background" style={{ height: TIMELINE_HEADER_HEIGHT }}>
      <div className="absolute inset-x-0 top-0 border-b bg-muted/40" style={{ height: 24 }}>
        {groups.map(renderGroup)}
      </div>
      <div className="absolute inset-x-0 bottom-0" style={{ height: 32 }}>
        {cells.map(renderCell)}
      </div>
    </div>
  );
}