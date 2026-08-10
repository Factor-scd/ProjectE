import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

/**
 * Lightweight calendar heatmap — part of the shared chart set intentionally
 * implemented as plain divs instead of pulling in the recharts dependency.
 */
export function CalendarHeatmap({ data, days = 30 }: { data: any[]; days?: number }) {
  const today = new Date();
  const dateMap = new Map(data.map((d) => [d.date?.slice(0, 10), d.count || 0]));
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const count = dateMap.get(key) || 0;
    const intensity = count > 0 ? Math.min(count / 5, 1) : 0;
    const color = intensity > 0.75 ? "bg-green-600" : intensity > 0.5 ? "bg-green-500" : intensity > 0.25 ? "bg-green-400" : intensity > 0 ? "bg-green-200" : "bg-muted";
    cells.push(
      <div key={key} className={cn("w-3 h-3 rounded-sm", color)} title={key + ": " + count + " completions"} />
    );
  }
  return <div className="flex flex-wrap gap-0.5">{cells}</div>;
}
