"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, Circle, MoreHorizontal, Flame, Filter, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HabitCreateDialog } from "@/components/habits/habit-create-dialog";
import { HabitEditDialog } from "@/components/habits/habit-edit-dialog";
import { HabitCompletionDialog } from "@/components/habits/habit-completion-dialog";
import { HabitCalendarHeatmap } from "@/components/habits/habit-calendar-heatmap";
import { HabitAnalytics } from "@/components/habits/habit-analytics";
import { CreateItemDialog } from "@/components/create-item-dialog";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";
import { toast } from "sonner";

interface Habit {
  id: string;
  name: string;
  description: string | null;
  domainId: string;
  frequency: 'daily' | 'weekly' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  goalPerPeriod: number;
  unit: string | null;
  streakCount: number;
  bestStreak: number;
  active: boolean;
  moodTracking: boolean;
  tags: { id: string; name: string; color: string | null }[];
}

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  hard: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const { open: storeOpen, openCreate, closeCreate } = useCreateDialogStore();
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [completionHabit, setCompletionHabit] = useState<Habit | null>(null);
  const [deleteHabit, setDeleteHabit] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Fetch domains
  useEffect(() => {
    fetch('/api/domains?sort=sort_order')
      .then((res) => res.json())
      .then((data) => {
        const items = data.items || [];
        setDomains(items);
        if (items.length > 0 && !domainId) {
          setDomainId(items[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch habits
  const fetchHabits = useCallback(async () => {
    if (!domainId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'active') params.set('active', 'true');
      const res = await fetch(`/api/domains/${domainId}/habits?${params}`);
      const data = await res.json();
      setHabits(data.items || []);
    } catch {
      toast.error('Failed to load habits');
    } finally {
      setLoading(false);
    }
  }, [domainId, filter]);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  // Complete a habit
  const handleComplete = async (habit: Habit, value?: number, mood?: number, notes?: string) => {
    try {
      const res = await fetch(`/api/domains/${domainId}/habits/${habit.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: value ?? 1, mood, notes }),
      });
      if (!res.ok) throw new Error('Failed to complete');
      toast.success(`"${habit.name}" logged!`);
      fetchHabits();
    } catch {
      toast.error('Failed to complete habit');
    }
  };

  // Listen for custom event to open create dialog
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    document.addEventListener('open-create-habit', handler);
    return () => document.removeEventListener('open-create-habit', handler);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="mt-1 text-muted-foreground">Build streaks, track progress, stay consistent.</p>
        </div>
        <div className="flex items-center gap-2">
          {domains.length > 1 && (
            <select
              value={domainId || ''}
              onChange={(e) => setDomainId(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Select domain"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 rounded-md border p-1">
            <button
              onClick={() => setFilter('all')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${filter === 'all' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${filter === 'active' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Active
            </button>
          </div>
          <Button onClick={() => { setCreateOpen(true); openCreate('habit'); }}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New habit
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading habits...</div>
      ) : habits.length === 0 ? (
        <div className="py-12 text-center">
          <Flame className="mx-auto h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No habits yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <div key={habit.id} className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => handleComplete(habit)}
                  className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  aria-label={`Complete ${habit.name}`}
                >
                  <Circle className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{habit.name}</span>
                    <Badge variant="secondary" className={`text-xs ${difficultyColors[habit.difficulty] || ''}`}>
                      {habit.difficulty}
                    </Badge>
                    {habit.unit && (
                      <span className="text-xs text-muted-foreground">per {habit.unit}</span>
                    )}
                  </div>
                  {habit.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {habit.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: tag.color || '#e2e8f0', color: '#1e293b' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-sm" title="Current streak">
                    <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
                    <span className="font-semibold">{habit.streakCount}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={`Options for ${habit.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditHabit(habit)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteHabit(habit)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => setExpandedHabit(expandedHabit === habit.id ? null : habit.id)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={expandedHabit === habit.id ? 'Collapse' : 'Expand'}
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expandedHabit === habit.id && (
                <div className="border-t px-4 py-3">
                  <HabitCalendarHeatmap habitId={habit.id} domainId={domainId!} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      <div className="mt-4">
        <HabitAnalytics domainId={domainId || ""} habits={habits} />
      </div>

      <HabitCreateDialog
        open={createOpen}
        onOpenChange={(o) => { setCreateOpen(o); if (!o) closeCreate(); }}
        domainId={domainId || ''}
        onCreated={fetchHabits}
      />

      {/* Global CreateItemDialog from useCreateDialogStore — opened by topbar 'New habit' button */}
      <CreateItemDialog
        type="habit"
        open={storeOpen}
        onOpenChange={(o) => { if (!o) closeCreate(); else openCreate('habit'); }}
        onCreated={fetchHabits}
      />

      {editHabit && (
        <HabitEditDialog
          open={!!editHabit}
          onOpenChange={(open) => { if (!open) setEditHabit(null); }}
          habit={editHabit}
          domainId={domainId || ''}
          onUpdated={fetchHabits}
        />
      )}

      {completionHabit && (
        <HabitCompletionDialog
          open={!!completionHabit}
          onOpenChange={(open) => { if (!open) setCompletionHabit(null); }}
          habit={completionHabit}
          onComplete={(value, mood, notes) => {
            handleComplete(completionHabit, value, mood, notes);
            setCompletionHabit(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteHabit} onOpenChange={(open) => { if (!open) setDeleteHabit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Habit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteHabit?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async () => {
                if (!deleteHabit || !domainId) return;
                setDeleting(true);
                try {
                  const res = await fetch(`/api/domains/${domainId}/habits/${deleteHabit.id}`, {
                    method: 'DELETE',
                  });
                  if (!res.ok) throw new Error('Failed to delete');
                  toast.success('Habit deleted');
                  setDeleteHabit(null);
                  fetchHabits();
                } catch {
                  toast.error('Failed to delete habit');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
