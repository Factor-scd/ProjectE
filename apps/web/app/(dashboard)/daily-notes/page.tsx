'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { BookOpen, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { format, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const NoteEditor = dynamic(
  () => import('@/components/notes/note-editor').then((m) => m.NoteEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading editor...</div>
      </div>
    ),
  }
);

interface Note {
  id: string;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function DailyNotesPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Failed'>('Saved');

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const displayDate = format(currentDate, 'EEEE, MMMM d, yyyy');

  const fetchDailyNote = useCallback(async () => {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch(`/api/notes/daily?date=${dateStr}`);
      if (!res.ok) throw new Error('Failed to fetch daily note');
      const data = await res.json();
      if (data.note) {
        setNote(data.note);
      }
    } catch (err) {
      console.error('Failed to fetch daily note:', err);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    fetchDailyNote();
  }, [fetchDailyNote]);

  async function handleCreateDailyNote() {
    setCreating(true);
    try {
      const res = await fetch('/api/notes/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Failed to create daily note', text);
        toast.error('Failed to create daily note');
        return;
      }
      const createdNote = await res.json();
      setNote(createdNote);
      toast.success('Daily note created');
    } catch (err) {
      console.error('Failed to create daily note:', err);
      toast.error('Failed to create daily note');
    } finally {
      setCreating(false);
    }
  }

  function navigate(delta: number) {
    const next = delta > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1);
    setCurrentDate(next);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  async function handleSave(content: string) {
    if (!note) return;
    setSaveStatus('Saving');
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('Saved');
    } catch (err) {
      console.error('Failed to save note:', err);
      setSaveStatus('Failed');
      toast.error('Failed to save note');
    }
  }

  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Notes</h1>
          <p className="mt-1 text-muted-foreground">
            {displayDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(1)}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="min-h-[500px]">
        {loading ? (
          <div className="flex h-[500px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : note ? (
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{note.title}</h2>
                <span className="text-xs text-muted-foreground" role="status">
                  {saveStatus}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <div className="animate-pulse text-sm text-muted-foreground">
                      Loading editor...
                    </div>
                  </div>
                }
              >
                <NoteEditor
                  content={note.content || ''}
                  onChange={(content) => {
                    setNote({ ...note, content });
                    handleSave(content);
                  }}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="flex h-[500px] flex-col items-center justify-center gap-4">
            <BookOpen className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">No daily note yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isToday
                  ? 'Create your daily note to track what you accomplished today.'
                  : 'No daily note exists for this date.'}
              </p>
            </div>
            <Button onClick={handleCreateDailyNote} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {creating ? 'Creating...' : 'Create today\'s note'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
