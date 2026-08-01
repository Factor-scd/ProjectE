'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  domainId: string;
  frequency: 'daily' | 'weekly' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  goalPerPeriod: number;
  unit: string | null;
  active: boolean;
  moodTracking: boolean;
  tags: { id: string; name: string; color: string | null }[];
}

interface HabitEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit;
  domainId: string;
  onUpdated: () => void;
}

export function HabitEditDialog({
  open,
  onOpenChange,
  habit,
  domainId,
  onUpdated,
}: HabitEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [goalPerPeriod, setGoalPerPeriod] = useState('1');
  const [unit, setUnit] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [moodTracking, setMoodTracking] = useState(false);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && habit) {
      setName(habit.name);
      setDescription(habit.description || '');
      setFrequency(habit.frequency);
      setDifficulty(habit.difficulty);
      setGoalPerPeriod(String(habit.goalPerPeriod));
      setUnit(habit.unit || '');
      setReminderTime('');
      setMoodTracking(habit.moodTracking);
      setActive(habit.active);
      setSelectedTagIds(habit.tags.map(t => t.id));
      setError('');

      fetch(`/api/domains/${domainId}/tags`)
        .then(res => res.json())
        .then(data => setAvailableTags(data.items || []))
        .catch(() => {});
    }
  }, [open, habit, domainId]);

  function toggleTag(tagId: string) {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!domainId) {
      setError('No domain selected');
      return;
    }
    setSubmitting(true);
    setError('');

    const body: Record<string, unknown> = {
      name,
      frequency,
      difficulty,
      goalPerPeriod: parseInt(goalPerPeriod, 10) || 1,
      moodTracking,
      active,
    };
    if (description) body.description = description;
    if (unit) body.unit = unit;
    if (reminderTime) body.reminderTime = reminderTime;

    try {
      const response = await fetch(`/api/domains/${domainId}/habits/${habit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to update habit');
      }

      // Sync tags
      const currentTagIds = habit.tags.map(t => t.id);
      const toRemove = currentTagIds.filter(id => !selectedTagIds.includes(id));
      const toAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));

      await Promise.all([
        ...toRemove.map(tagId =>
          fetch(`/api/domains/${domainId}/habits/${habit.id}/tags`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagId }),
          })
        ),
        ...toAdd.map(tagId =>
          fetch(`/api/domains/${domainId}/habits/${habit.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagId }),
          })
        ),
      ]);

      toast.success('Habit updated');
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update habit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/domains/${domainId}/habits/${habit.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to delete habit');
      }

      toast.success('Habit deleted');
      setDeleteOpen(false);
      onOpenChange(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete habit');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Habit</DialogTitle>
            <DialogDescription>Update your habit details.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="edit-habit-name">Name *</Label>
              <Input
                id="edit-habit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning meditation"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-habit-description">Description</Label>
              <Textarea
                id="edit-habit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-habit-frequency">Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
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
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-habit-goal">Goal per period</Label>
                <Input
                  id="edit-habit-goal"
                  type="number"
                  min={1}
                  value={goalPerPeriod}
                  onChange={(e) => setGoalPerPeriod(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-habit-unit">Unit (optional)</Label>
                <Input
                  id="edit-habit-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. minutes, pages"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-habit-reminder">Reminder time (optional)</Label>
              <Input
                id="edit-habit-reminder"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="edit-habit-active"
                checked={active}
                onCheckedChange={setActive}
              />
              <Label htmlFor="edit-habit-active">Active</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="edit-habit-mood"
                checked={moodTracking}
                onCheckedChange={setMoodTracking}
              />
              <Label htmlFor="edit-habit-mood">Enable mood tracking</Label>
            </div>

            {availableTags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedTagIds.includes(tag.id)
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tag.color || '#e2e8f0', color: '#1e293b' }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name || !domainId}>
                  {submitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Habit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{habit.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
