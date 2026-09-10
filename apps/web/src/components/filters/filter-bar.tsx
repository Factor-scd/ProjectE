import { CalendarClock, Flag, FolderKanban, Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { State } from "@/lib/types";

export type DueFilter = "all" | "overdue" | "today" | "week" | "none";

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: "Any due date",
  overdue: "Overdue",
  today: "Due today",
  week: "Due this week",
  none: "No due date",
};

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  projects: { id: string; name: string; color?: string | null }[];
  projectId: string;
  onProjectChange: (v: string) => void;
  states: State[];
  stateId: string;
  onStateChange: (v: string) => void;
  priority: string;
  onPriorityChange: (v: string) => void;
  dueFilter: DueFilter;
  onDueChange: (v: DueFilter) => void;
  onClearAll: () => void;
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge
      className="gap-1 border-[#91caff] bg-[#e6f4ff] pl-2 pr-1 text-[11px] font-medium text-[#002c8c] hover:bg-[#bae0ff]"
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-[#91caff]/40"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

export function FilterBar({
  search,
  onSearchChange,
  projects,
  projectId,
  onProjectChange,
  states,
  stateId,
  onStateChange,
  priority,
  onPriorityChange,
  dueFilter,
  onDueChange,
  onClearAll,
}: FilterBarProps) {
  const projectName = projects.find((p) => p.id === projectId)?.name;
  const stateName = states.find((s) => s.id === stateId)?.name;
  const activeCount =
    (projectId ? 1 : 0) + (stateId ? 1 : 0) + (priority ? 1 : 0) + (dueFilter !== "all" ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8"
            aria-label="Search tasks"
          />
        </div>

        <Select value={projectId || "__all__"} onValueChange={(v) => onProjectChange(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-44" aria-label="Filter by project">
            <FolderKanban className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || "#1677ff" }} />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {states.length > 0 && (
          <Select value={stateId || "__all__"} onValueChange={(v) => onStateChange(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-40" aria-label="Filter by state">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All states</SelectItem>
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || "#94a3b8" }} />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={priority || "__all__"} onValueChange={(v) => onPriorityChange(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-36" aria-label="Filter by priority">
            <Flag className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Any priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {dueFilter === "all" ? "Due date" : DUE_FILTER_LABELS[dueFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Due date</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(DUE_FILTER_LABELS) as DueFilter[]).map((d) => (
              <DropdownMenuItem key={d} onClick={() => onDueChange(d)}>
                {DUE_FILTER_LABELS[d]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={onClearAll}>
            <X className="h-3.5 w-3.5" /> Clear ({activeCount})
          </Button>
        )}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <SlidersHorizontal className="h-3 w-3" /> Active:
          </span>
          {projectName && <Chip label={projectName} onRemove={() => onProjectChange("")} />}
          {stateName && <Chip label={stateName} onRemove={() => onStateChange("")} />}
          {priority && <Chip label={`Priority: ${priority}`} onRemove={() => onPriorityChange("")} />}
          {dueFilter !== "all" && <Chip label={DUE_FILTER_LABELS[dueFilter]} onRemove={() => onDueChange("all")} />}
          {search && <Chip label={`"${search}"`} onRemove={() => onSearchChange("")} />}
        </div>
      )}
    </div>
  );
}
