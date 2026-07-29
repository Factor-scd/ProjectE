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

interface HabitCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domainId: string;
  onCreated: () => void;
}

export function HabitCreateDialog({
  open,
  onOpenChange,
  domainId,
  onCreated,
}: HabitCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [goalPerPeriod, setGoalPerPeriod] = useState('1');
  const [unit, setUnit] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [moodTracking, setMoodTracking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setFrequency('daily');
      setDifficulty('medium');
      setGoalPerPeriod('1');
      setUnit('');
      setReminderTime('');
      setMoodTracking(false);
      setError('');
    }
  }, [open]);

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
    };
    if (description) body.description = description;
    if (unit) body.unit = unit;
    if (reminderTime) body.reminderTime = reminderTime;

    try {
      const response = await fetch(`/api/domains/${domainId}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Unable to create habit');
      }

      toast.success('Habit created');
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create habit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Habit</DialogTitle>
          <DialogDescription>Create a new habit to track daily or weekly.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name *</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning meditation"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-description">Description</Label>
            <Textarea
              id="habit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="habit-frequency">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as any)}>
                <SelectTrigger id="habit-frequency">
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
              <Label htmlFor="habit-difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger id="habit-difficulty">
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
              <Label htmlFor="habit-goal">Goal per period</Label>
              <Input
                id="habit-goal"
                type="number"
                min={1}
                value={goalPerPeriod}
                onChange={(e) => setGoalPerPeriod(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="habit-unit">Unit (optional)</Label>
              <Input
                id="habit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. minutes, pages"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-reminder">Reminder time (optional)</Label>
            <Input
              id="habit-reminder"
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="habit-mood"
              checked={moodTracking}
              onCheckedChange={setMoodTracking}
            />
            <Label htmlFor="habit-mood">Enable mood tracking</Label>
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name || !domainId}>
              {submitting ? 'Creating...' : 'Create Habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
