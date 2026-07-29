'use client';

import { useState } from 'react';
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

interface Habit {
  id: string;
  name: string;
  unit: string | null;
  moodTracking: boolean;
}

interface HabitCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit;
  onComplete: (value: number, mood?: number, notes?: string) => void;
}

const moodEmojis = [
  { value: 1, emoji: '😞', label: 'Bad' },
  { value: 2, emoji: '😐', label: 'Okay' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🤩', label: 'Amazing' },
];

export function HabitCompletionDialog({
  open,
  onOpenChange,
  habit,
  onComplete,
}: HabitCompletionDialogProps) {
  const [value, setValue] = useState('1');
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Log &quot;{habit.name}&quot;</DialogTitle>
          <DialogDescription>Record your progress for today.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {habit.unit && (
            <div className="space-y-2">
              <Label htmlFor="completion-value">Value ({habit.unit})</Label>
              <Input
                id="completion-value"
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}

          {habit.moodTracking && (
            <div className="space-y-2">
              <Label>Mood</Label>
              <div className="flex gap-2">
                {moodEmojis.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(mood === m.value ? null : m.value)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors ${
                      mood === m.value
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                        : 'bg-muted hover:bg-accent'
                    }`}
                    title={m.label}
                    aria-label={`Mood: ${m.label}`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="completion-notes">Notes (optional)</Label>
            <Textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go?"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => onComplete(parseInt(value) || 1, mood || undefined, notes || undefined)}>
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
