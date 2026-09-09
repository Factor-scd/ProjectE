import { useState } from "react";
import { createRoute, useParams, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  Calendar,
  CalendarOff,
  CheckCircle2,
  Clock,
  Flame,
  RepeatIcon,
  Target,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api, useApiQuery } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { useOptimisticPatch } from "@/hooks/use-optimistic-patch";
import { EntityDetailPage } from "@/components/entities/detail-page";
import {
  InlineEdit,
  InlineSelect,
  InlineText,
  InlineTextarea,
  InlineToggle,
  type InlineSelectOption,
} from "@/components/entities/inline-edit";
import { EntityActivity } from "@/components/entities/entity-activity";
import { EntityComments } from "@/components/entities/entity-comments";
import { TagManager } from "@/components/entities/tag-manager";
import { CalendarHeatmap } from "@/components/charts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, ErrorState } from "@/components/state";
import type { Habit } from "@/lib/types";

const FREQUENCY_OPTIONS: InlineSelectOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

const DIFFICULTY_OPTIONS: InlineSelectOption[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/** Difficulty badge text colors (no shared token exists for habit difficulty). */
const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-green-600",
  medium: "text-amber-600",
  hard: "text-red-600",
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Query keys to keep fresh after any habit-affecting mutation. Mirrors the
// realtime hook's invalidation so list/analytics views never go stale.
const LIST_KEYS: string[][] = [
  ["habits"],
  ["habits-today"],
  ["streaks"],
  ["analytics-habits"],
];

type PatchFn = (vars: { id: string; data: Record<string, unknown> }) => void;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function HabitDetail() {
  const { id } = useParams({ from: Route.id });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);

  useRealtime({ enabled: true });

  const { data: habit, isLoading, isError, error, refetch } = useApiQuery<Habit>(
    ["habit", id, String(days)],
    `/habits/${id}?days=${days}`
  );

  const { patch } = useOptimisticPatch<Habit>({
    entityKey: ["habit", id, String(days)],
    listKeys: LIST_KEYS,
    patchUrl: (hid) => `/habits/${hid}`,
    applyPatch: (current, data) => ({ ...current, ...data }),
  });

  const logToday = useMutation({
    mutationFn: () => api.post(`/habits/${id}/complete`, {}),
    onSuccess: () => {
      toast.success("Logged for today");
      queryClient.invalidateQueries({ queryKey: ["habit", id] });
      for (const key of LIST_KEYS) queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/habits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast.success("Habit deleted");
      navigate({ to: "/habits" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingState label="Loading habit..." />;
  if (isError) {
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  }
  if (!habit) return <ErrorState message="Habit not found" />;

  return (
    <EntityDetailPage
      backTo={{ to: "/habits", label: "Back to Habits" }}
      title={
        <InlineText
          value={habit.name}
          onSave={(name) => patch({ id, data: { name } })}
          placeholder="Untitled habit"
        />
      }
      icon={<Flame className="h-6 w-6 text-orange-500" />}
      badges={
        <>
          <InlineToggle
            checked={habit.active}
            onSave={(active) => patch({ id, data: { active } })}
            label={habit.active ? "Active" : "Inactive"}
          />
          <InlineSelect
            value={habit.frequency}
            options={FREQUENCY_OPTIONS}
            onSave={(frequency) => patch({ id, data: { frequency } })}
          />
        </>
      }
      actions={
        <>
          <Button onClick={() => logToday.mutate()} disabled={logToday.isPending}>
            <CheckCircle2 className="h-4 w-4" /> Log today
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Habit</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{habit.name}"? This action cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground"
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      }
      tabs={[
        { value: "overview", label: "Overview", content: <Overview habit={habit} patch={patch} /> },
        {
          value: "stats",
          label: "Stats",
          content: <Stats habit={habit} days={days} setDays={setDays} />,
        },
        { value: "log", label: "Log", content: <LogTab habit={habit} days={days} /> },
        {
          value: "activity",
          label: "Activity",
          content: <EntityActivity entityType="habit" entityId={id} />,
        },
        {
          value: "comments",
          label: "Comments",
          content: <EntityComments entityType="habit" entityId={id} />,
        },
      ]}
    />
  );
}

function Overview({ habit, patch }: { habit: Habit; patch: PatchFn }) {
  const completions = habit.recentCompletions || [];
  const distinctCompletionDays = new Set(
    completions.map((c) => c.date.slice(0, 10))
  ).size;
  const skipDays = habit.skipDays || [];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Description</p>
        <InlineTextarea
          value={habit.description ?? ""}
          onSave={(description) =>
            patch({ id: habit.id, data: { description: description || null } })
          }
          placeholder="Add a description…"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <RepeatIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineSelect
            value={habit.frequency}
            options={FREQUENCY_OPTIONS}
            onSave={(frequency) => patch({ id: habit.id, data: { frequency } })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineSelect
            value={habit.difficulty}
            options={DIFFICULTY_OPTIONS}
            displayValue={(v) => (
              <Badge variant="outline" className={DIFFICULTY_COLOR[v] ?? ""}>
                {DIFFICULTY_OPTIONS.find((o) => o.value === v)?.label ?? v}
              </Badge>
            )}
            onSave={(difficulty) => patch({ id: habit.id, data: { difficulty } })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineEdit
            value={habit.goalPerPeriod}
            onSave={(goal) =>
              patch({ id: habit.id, data: { goalPerPeriod: Number(goal) || 1 } })
            }
            display={(goal) => (
              <span className="font-mono text-xs">
                {habit.unit ? `${goal} ${habit.unit} per period` : `${goal} per period`}
              </span>
            )}
            renderEdit={(v, onChange, commit, cancel) => (
              <Input
                type="number"
                min={1}
                value={v}
                onChange={(e) => onChange(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  else if (e.key === "Escape") cancel();
                }}
                onBlur={() => commit()}
                autoFocus
                className="h-7 w-24 text-sm"
              />
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineEdit
            value={habit.reminderTime ?? ""}
            onSave={(time) =>
              patch({ id: habit.id, data: { reminderTime: time || null } })
            }
            display={(time) =>
              time ? (
                <span className="font-mono text-xs">Reminder {time}</span>
              ) : (
                <span className="text-muted-foreground/70">No reminder</span>
              )
            }
            renderEdit={(v, onChange, commit, cancel) => (
              <Input
                type="time"
                value={v}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  else if (e.key === "Escape") cancel();
                }}
                onBlur={() => commit()}
                autoFocus
                className="h-7 text-sm"
              />
            )}
          />
        </div>
        {skipDays.length > 0 ? (
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap gap-1">
              {skipDays.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px]">
                  {DAY_SHORT[d] ?? d}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <InlineToggle
            checked={habit.moodTracking}
            onSave={(moodTracking) => patch({ id: habit.id, data: { moodTracking } })}
            label="Mood tracking"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{habit.streakCount}</p>
          <p className="text-[11px] text-muted-foreground">Current Streak</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{habit.bestStreak}</p>
          <p className="text-[11px] text-muted-foreground">Best Streak</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{distinctCompletionDays}</p>
          <p className="text-[11px] text-muted-foreground">Completion This Period</p>
        </div>
      </div>

      <div className="border-t pt-3">
        <TagManager entityType="habit" entityId={habit.id} tags={habit.tags || []} />
      </div>

      <div className="flex items-center gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Created <span className="font-mono">{format(parseISO(habit.createdAt), "MMM d, yyyy HH:mm")}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Updated <span className="font-mono">{format(parseISO(habit.updatedAt), "MMM d, yyyy HH:mm")}</span>
        </span>
      </div>
    </div>
  );
}

function Stats({
  habit,
  days,
  setDays,
}: {
  habit: Habit;
  days: number;
  setDays: (d: number) => void;
}) {
  const completions = habit.recentCompletions || [];
  const distinctCompletionDays = new Set(
    completions.map((c) => c.date.slice(0, 10))
  ).size;
  const completionRate = Math.round((distinctCompletionDays / days) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-8 w-40 text-sm" aria-label="Range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
            <SelectItem value="365">Last 365 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{habit.streakCount}</p>
          <p className="text-[11px] text-muted-foreground">Current Streak</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{habit.bestStreak}</p>
          <p className="text-[11px] text-muted-foreground">Best Streak</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-xl font-bold font-mono">{completionRate}%</p>
          <p className="text-[11px] text-muted-foreground">Completion Rate</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Completion Heatmap</p>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            Last {days} days
          </span>
        </div>
        <div className="mt-3">
          {completions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No completions in this period.
            </p>
          ) : (
            <CalendarHeatmap
              data={completions.map((c) => ({
                date: c.date.slice(0, 10),
                count: c.value,
              }))}
              days={days}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LogTab({ habit, days }: { habit: Habit; days: number }) {
  const completions = habit.recentCompletions || [];

  if (completions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No completions in the last {days} days.
      </p>
    );
  }

  const sorted = [...completions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-0.5">
      {sorted.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm">{format(parseISO(c.date), "EEE, MMM d, yyyy")}</span>
          {c.value > 1 && <Badge variant="secondary">{c.value}x</Badge>}
          {c.mood != null && (
            <span className="text-xs text-muted-foreground">Mood {c.mood}/5</span>
          )}
          {c.notes ? (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {c.notes}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "habits/$id",
  component: HabitDetail,
});
