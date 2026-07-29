'use client';

import { useEffect, useState } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface Note {
  id: string;
  title: string;
  updated_at: string;
  is_pinned: boolean;
}

export function RecentNotesWidget() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      const res = await fetch('/api/notes?perPage=5&sort=-updated');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.items || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Recent Notes
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-accent/50"
                onClick={() => router.push('/notes')}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">
                  {note.is_pinned && '📌 '}
                  {note.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(note.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
