import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { StatusDefinition } from "@/lib/types";

export type ZoomLevel = "day" | "week" | "month";

export interface TimelineTask {
  id: string;
  title: string;
  startDate: string;
  dueDate: string | null;
  statusId: string | null;
  status: StatusDefinition | null;
  sectionId: string | null;
  dependencies: string[];
}

export interface TimelineMilestone {
  id: string;
  name: string;
  targetDate: string;
}

export interface TimelineData {
  tasks: TimelineTask[];
  milestones: TimelineMilestone[];
}

export const ROW_HEIGHT = 40;
export const MILESTONE_BAND_HEIGHT = 48;
export const TIMELINE_HEADER_HEIGHT = 56;
export const TASK_LIST_WIDTH = 224;

const PIXELS_PER_DAY: Record<ZoomLevel, number> = {
  day: 36,
  week: 12,
  month: 5,
};

export function getPixelsPerDay(zoom: ZoomLevel): number {
  return PIXELS_PER_DAY[zoom];
}

/** Normalize a date (or ISO string) to local midnight. */
export function toDayStart(date: Date | string): Date {
  return startOfDay(typeof date === "string" ? parseISO(date) : date);
}

/** Horizontal pixel offset of a date from the view start (local calendar days). */
export function positionForDate(date: Date | string, viewStart: Date, pixelsPerDay: number): number {
  return differenceInCalendarDays(toDayStart(date), startOfDay(viewStart)) * pixelsPerDay;
}

/** Date (local midnight) at a given horizontal pixel offset from the view start. */
export function dateForPosition(x: number, viewStart: Date, pixelsPerDay: number): Date {
  return addDays(startOfDay(viewStart), Math.round(x / pixelsPerDay));
}

/** Column start dates for the timeline header at the given zoom. */
export function getDateRange(start: Date, end: Date, zoom: ZoomLevel): Date[] {
  const s = startOfDay(start);
  const e = endOfDay(end);
  switch (zoom) {
    case "day":
      return eachDayOfInterval({ start: s, end: e });
    case "week":
      return eachWeekOfInterval({ start: startOfWeek(s, { weekStartsOn: 1 }), end: e }, { weekStartsOn: 1 });
    case "month":
      return eachMonthOfInterval({ start: startOfMonth(s), end: endOfMonth(e) });
  }
}