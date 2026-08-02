"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, CheckCircle2, Circle, MoreHorizontal, Flame, Filter, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { HabitCreateDialog } from "@/components/habits/habit-create-dialog";
import { HabitCompletionDialog } from "@/components/habits/habit-completion-dialog";
import { HabitCalendarHeatmap } from "@/components/habits/habit-calendar-heatmap";
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
  const [completionHabit, setCompletionHabit] = useState<Habit | null>(null);
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly" | "custom">("daily");
  const [editDifficulty, setEditDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [editGoalPerPeriod, setEditGoalPerPeriod] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  // Edit a habit
  const handleEdit = async () => {
    if (!editingHabit || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/habits/${editingHabit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription || null,
          frequency: editFrequency,
          difficulty: editDifficulty,
          goalPerPeriod: editGoalPerPeriod,
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Habit updated');
      setEditingHabit(null);
      fetchHabits();
    } catch {
      toast.error('Failed to update habit');
    } finally {
      setSaving(false);
    }
  };

  // Delete a habit
  const handleDelete = async () => {
    if (!deleteHabitId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/habits/${deleteHabitId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Habit deleted');
      setDeleteHabitId(null);
      fetchHabits();
    } catch {
      toast.error('Failed to delete habit');
    } finally {
      setDeleting(false);
    }
  };

  // Open edit dialog with habit data
  const openEdit = (habit: Habit) => {
    setEditName(habit.name);
    setEditDescription(habit.description || "");
    setEditFrequency(habit.frequency);
    setEditDifficulty(habit.difficulty);
    setEditGoalPerPeriod(habit.goalPerPeriod || 1);
    setEditingHabit(habit);
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
          <Button onClick={() => setCreateOpen(true)}>
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
                      <DropdownMenuItem onClick={() => openEdit(habit)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCompletionHabit(habit)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Log details
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteHabitId(habit.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
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

      <HabitCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        domainId={domainId || ''}
        onCreated={fetchHabits}
      />

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

      {/* Edit Habit Dialog */}
      <Dialog open={!!editingHabit} onOpenChange={(open) => { if (!open) setEditingHabit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
            <DialogDescription>Update your habit details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-habit-name">Name</Label>
              <Input id="edit-habit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-habit-description">Description</Label>
              <Textarea id="edit-habit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-habit-frequency">Frequency</Label>
                <Select value={editFrequency} onValueChange={(v: "daily" | "weekly" | "custom") => setEditFrequency(v)}>
                  <SelectTrigger id="edit-habit-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-habit-difficulty">Difficulty</Label>
                <Select value={editDifficulty} onValueChange={(v: "easy" | "medium" | "hard") => setEditDifficulty(v)}>
                  <SelectTrigger id="edit-habit-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-habit-goal">Goal per period</Label>
              <Input id="edit-habit-goal" type="number" min="1" value={editGoalPerPeriod} onChange={(e) => setEditGoalPerPeriod(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingHabit(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Habit Confirmation */}
      <AlertDialog open={!!deleteHabitId} onOpenChange={(open) => { if (!open) setDeleteHabitId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete habit?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. The habit and all its completion history will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
