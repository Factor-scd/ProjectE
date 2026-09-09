import { useState } from "react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { Plus, Flame, Trash2, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EntityDetailPanel } from "@/components/entities/entity-detail-panel";
import { LoadingState, EmptyState, ErrorState } from "@/components/state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Habit, HabitCompletion, PaginatedResponse } from "@/lib/types";

function HabitForm({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [name, setName] = useState(habit?.name || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [frequency, setFrequency] = useState(habit?.frequency || "daily");
  const [difficulty, setDifficulty] = useState(habit?.difficulty || "medium");
  const [goalPerPeriod, setGoalPerPeriod] = useState(habit?.goalPerPeriod || 1);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<Habit>("/habits", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["habits"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch<Habit>("/habits/" + habit!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["habits"] }); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = { name: name.trim(), description: description || null, frequency, difficulty, goalPerPeriod };
    if (habit) updateMutation.mutate(data);
    else createMutation.mutate({ ...data, ...(activeDomainId ? { domain: activeDomainId } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Habit name" required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="freq">Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as "daily" | "weekly" | "custom")}>
            <SelectTrigger id="freq"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="diff">Difficulty</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}>
            <SelectTrigger id="diff"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="goal">Goal per period</Label>
        <Input id="goal" type="number" min={1} value={goalPerPeriod} onChange={(e) => setGoalPerPeriod(parseInt(e.target.value) || 1)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {habit ? "Update" : "Create"} Habit
        </Button>
      </div>
    </form>
  );
}

function MiniGrid({ completions, days = 7 }: { completions: HabitCompletion[]; days?: number }) {
  const completionDates = new Set(completions.map((c) => new Date(c.date).toISOString().slice(0, 10)));
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const done = completionDates.has(key);
    cells.push(
      <div
        key={key}
        className={cn("w-2.5 h-2.5 rounded-sm", done ? "bg-green-500" : "bg-muted")}
        title={key + (done ? " ✓" : "")}
      />
    );
  }
  return <div className="flex gap-0.5 items-center">{cells}</div>;
}

function HabitsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");

  useRealtime({ enabled: true });

  useOpenCreateDialog("habit", () => setCreateOpen(true));

  const activeDomainId = useApiDomain();

  const habitQueryUrl = () => "/habits?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "");

  const { data: habitsData, isLoading, isError, refetch } = useApiQuery<PaginatedResponse<Habit>>(
    ["habits", activeDomainId],
    habitQueryUrl()
  );

  const habits = habitsData?.items || [];
  const hasMoreHabits = habits.length < (habitsData?.totalItems || 0);
  const [loadingMoreHabits, setLoadingMoreHabits] = useState(false);

  const loadMoreHabits = async () => {
    if (!hasMoreHabits || loadingMoreHabits) return;
    setLoadingMoreHabits(true);
    try {
      const next = await api.get<PaginatedResponse<Habit>>(habitQueryUrl() + "&offset=" + habits.length);
      queryClient.setQueryData<PaginatedResponse<Habit>>(["habits", activeDomainId], (old) => {
        if (!old) return old;
        const seen = new Set(old.items.map((h) => h.id));
        return { ...old, items: [...old.items, ...next.items.filter((h) => !seen.has(h.id))] };
      });
    } finally {
      setLoadingMoreHabits(false);
    }
  };

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post("/habits/" + id + "/complete", {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["habits"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/habits/" + id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["habits"] }); setPanelOpen(false); },
  });

  const openHabitDetail = (habit: Habit) => {
    navigate({ to: "/habits/$id", params: { id: habit.id } });
  };

  const openHabitPanel = async (habit: Habit) => {
    try {
      const detail = await api.get<Habit>("/habits/" + habit.id);
      setSelectedHabit(detail);
    } catch {
      setSelectedHabit(habit);
    }
    setPanelOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Habits</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button aria-label="New habit"><Plus className="h-4 w-4 mr-2" />New Habit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Habit</DialogTitle></DialogHeader>
            <HabitForm onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingState label="Loading habits..." />
      ) : isError ? (
        <ErrorState message="Failed to load habits." onRetry={() => refetch()} />
      ) : habits.length === 0 ? (
        <EmptyState icon={Flame} title="No habits yet" description="Create your first one to get started." />
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <Card key={habit.id} className="cursor-pointer border hover:bg-muted/20 transition-colors" onClick={() => openHabitDetail(habit)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Flame className={cn("h-5 w-5 shrink-0", habit.streakCount > 0 ? "text-orange-500" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{habit.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          <Flame className="h-3 w-3 inline mr-0.5" />
                          {habit.streakCount} day streak
                        </span>
                        <Badge variant="secondary" className="font-mono text-[10px]">{habit.frequency}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{habit.difficulty}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <MiniGrid completions={habit.recentCompletions || []} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(habit.recentCompletions || []).some((c) => {
                        const d = new Date(c.date);
                        const t = new Date();
                        return d.getUTCFullYear() === t.getUTCFullYear() && d.getUTCMonth() === t.getUTCMonth() && d.getUTCDate() === t.getUTCDate();
                      })}
                      onClick={(e) => { e.stopPropagation(); completeMutation.mutate(habit.id); }}
                      aria-label={"Mark " + habit.name + " complete"}
                      className={(habit.recentCompletions || []).some((c) => {
                        const d = new Date(c.date);
                        const t = new Date();
                        return d.getUTCFullYear() === t.getUTCFullYear() && d.getUTCMonth() === t.getUTCMonth() && d.getUTCDate() === t.getUTCDate();
                      }) ? "bg-green-500/10 text-green-600 border-green-500/20" : ""}
                    >
                      <Check className="h-4 w-4 mr-1" />Complete
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); openHabitPanel(habit); }}
                      aria-label={"Edit " + habit.name}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMoreHabits && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMoreHabits} disabled={loadingMoreHabits}>
            {loadingMoreHabits ? "Loading..." : "Load more habits"}
          </Button>
        </div>
      )}

      <EntityDetailPanel open={panelOpen} onOpenChange={(o) => { setPanelOpen(o); if (!o) setDetailTab("overview"); }} title={selectedHabit?.name || "Habit Details"}>
        {selectedHabit && (
          <div className="space-y-3">
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-3 pt-3">
                <HabitForm habit={selectedHabit} onClose={() => setPanelOpen(false)} />
                <div className="pt-3 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Habit</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Habit</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete "{selectedHabit.name}"?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(selectedHabit.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TabsContent>
              <TabsContent value="history" className="pt-3">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Completion History</h3>
                  {selectedHabit.recentCompletions?.length ? (
                    <div className="space-y-1">
                      {selectedHabit.recentCompletions.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                          <span>{new Date(c.date).toLocaleDateString()}</span>
                          <Badge variant="secondary"><Check className="h-3 w-3 mr-1" />{c.value}x</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No completions yet.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </EntityDetailPanel>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/habits",
  component: HabitsPage,
});
