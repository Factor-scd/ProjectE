'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Habit {
  id: string;
  name: string;
}

interface HabitCompletionDialogProps {
  habit: Habit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { mood?: number; value?: number; notes?: string }) => void;
}

const moods = [
  { value: 5, label: 'Great' },
  { value: 4, label: 'Good' },
  { value: 3, label: 'Okay' },
  { value: 2, label: 'Meh' },
  { value: 1, label: 'Bad' },
];

export function HabitCompletionDialog({
  habit,
  open,
  onOpenChange,
  onSubmit,
}: HabitCompletionDialogProps) {
  const [mood, setMood] = useState<number | undefined>();
  const [quantity, setQuantity] = useState<number | undefined>();
  const [notes, setNotes] = useState('');

  function handleSubmit() {
    onSubmit({
      mood,
      value: quantity,
      notes: notes || undefined,
    });
    setMood(undefined);
    setQuantity(undefined);
    setNotes('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log {habit.name}</DialogTitle>
          <DialogDescription>
            How did it go? (optional — you can skip and just log completion)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mood picker */}
          <div className="space-y-2">
            <Label>Mood</Label>
            <div className="flex gap-2">
              {moods.map((m) => (
                <Button
                  key={m.value}
                  variant={mood === m.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMood(m.value)}
                  className="flex-1"
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (optional)</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="e.g., 30"
              value={quantity ?? ''}
              onChange={(e) =>
                setQuantity(e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any thoughts or reflections..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} className="flex-1">
            Log completion
          </Button>
          <Button
            variant="outline"
            onClick={() => onSubmit({})}
            className="flex-1"
          >
            Skip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
