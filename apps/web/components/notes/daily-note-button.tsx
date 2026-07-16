'use client';

import { useState, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, subDays } from 'date-fns';

interface DailyNoteButtonProps {
  /** Called after the daily note is created/retrieved, with the raw PocketBase record. */
  onNoteReady: (note: Record<string, unknown>) => void;
  /** Optional: currently selected date (controls the displayed date). */
  selectedDate?: Date;
  /** Called when the user navigates to a different date. */
  onDateChange?: (date: Date) => void;
}

/**
 * Button row that creates / navigates daily notes.
 *
 * Layout:  ◀  [CalendarDays · 2026-07-15]  ▶
 *
 * Clicking the centre button POSTs to /api/notes/daily and opens the note.
 * The arrow buttons shift the date by one day without fetching.
 */
export function DailyNoteButton({
  onNoteReady,
  selectedDate,
  onDateChange,
}: DailyNoteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(
    selectedDate ?? new Date()
  );

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const displayDate = format(currentDate, 'MMM d, yyyy');

  const navigate = useCallback(
    (delta: number) => {
      const next = delta > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1);
      setCurrentDate(next);
      onDateChange?.(next);
    },
    [currentDate, onDateChange]
  );

  async function handleCreateDailyNote() {
    setLoading(true);
    try {
      const res = await fetch('/api/notes/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });

      if (!res.ok) {
        console.error('Failed to create daily note', await res.text());
        return;
      }

      const note = await res.json();
      onNoteReady(note);
    } catch (err) {
      console.error('Failed to create daily note:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(-1)}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleCreateDailyNote}
        disabled={loading}
      >
        <CalendarDays className="h-4 w-4" />
        {loading ? 'Creating…' : `Daily Note — ${displayDate}`}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => navigate(1)}
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
