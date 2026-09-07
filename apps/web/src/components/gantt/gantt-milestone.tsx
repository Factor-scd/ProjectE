import { format, parseISO } from "date-fns";
import type { TimelineMilestone } from "./gantt-utils";

interface GanttMilestoneProps {
  milestone: TimelineMilestone;
  /** Timeline pixel x where the diamond's center should sit. */
  x: number;
}

/** Diamond marker for a milestone, vertically centered with its date label. */
export function GanttMilestone({ milestone, x }: GanttMilestoneProps) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: x }}
      title={`Milestone: ${milestone.name} — ${format(parseISO(milestone.targetDate), "MMM d, yyyy")}`}
    >
      <div className="mt-1.5 h-4 w-4 rotate-45 rounded-[2px] border-2 border-background bg-amber-400 shadow-sm" />
      <span className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
        {format(parseISO(milestone.targetDate), "MMM d")}
      </span>
    </div>
  );
}