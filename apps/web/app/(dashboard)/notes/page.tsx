'use client';

import { useEffect, useState, Suspense } from 'react';
import { Plus, FileText, Link2, GitBranch } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DailyNoteButton } from '@/components/notes/daily-note-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lazy load TipTap editor (~80KB TipTap + extensions)
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

// Lazy load react-force-graph-2d (~120KB + three.js)
const NoteGraph = dynamic(
  () => import('@/components/notes/note-graph').then((m) => m.NoteGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Loading graph...</div>
      </div>
    ),
  }
);

interface Note {
  id: string;
  title: string;
  content: string;
  domain: string;
  created: string;
  updated: string;
}

interface Backlink {
  id: string;
  title: string;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (selectedNote) {
      fetchBacklinks(selectedNote.id);
    }
  }, [selectedNote]);

  async function fetchNotes() {
    try {
      const response = await fetch('/api/notes?sort=-updated');
      if (response.ok) {
        const data = await response.json();
        const notesList = data.items || [];
        setNotes(notesList);
        if (notesList.length > 0 && !selectedNote) {
          setSelectedNote(notesList[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBacklinks(noteId: string) {
    try {
      const response = await fetch(`/api/notes/${noteId}/backlinks`);
      if (response.ok) {
        const data = await response.json();
        setBacklinks(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
    }
  }

  async function createNote() {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled note',
          content: '',
          domain: 'personal',
        }),
      });
      if (response.ok) {
        const newNote = await response.json();
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }

  function handleDailyNoteReady(raw: Record<string, unknown>) {
    const note = raw as unknown as Note;
    // If the note already appears in the list, just select it
    const exists = notes.find((n) => n.id === note.id);
    if (exists) {
      setSelectedNote(exists);
      return;
    }
    // Otherwise prepend it and select
    setNotes([note, ...notes]);
    setSelectedNote(note);
  }

  async function updateNote(noteId: string, updates: Partial<Note>) {
    try {
      await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      fetchNotes();
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      const updatedNotes = notes.filter((n) => n.id !== noteId);
      setNotes(updatedNotes);
      if (selectedNote?.id === noteId) {
        setSelectedNote(updatedNotes[0] || null);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading notes...</p>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="mt-1 text-muted-foreground">
            Connect ideas to the work they shape.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DailyNoteButton onNoteReady={handleDailyNoteReady} />
          <Button onClick={createNote}>
            <Plus className="mr-2 h-4 w-4" />
            New note
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr_300px]">
        {/* Notes list */}
        <Card className="h-[calc(100vh-200px)]">
          <ScrollArea className="h-full">
            <div className="p-2">
              {notes.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No notes yet
                </p>
              ) : (
                <div className="space-y-1">
                  {notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => setSelectedNote(note)}
                      aria-label={`Open note: ${note.title}`}
                      aria-current={selectedNote?.id === note.id ? 'true' : undefined}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        selectedNote?.id === note.id
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {note.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {new Date(note.updated).toLocaleDateString()}
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {note.domain}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Note editor */}
        <Card className="h-[calc(100vh-200px)]">
          {selectedNote ? (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <label htmlFor="note-title" className="sr-only">
                  Note title
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) =>
                    setSelectedNote({
                      ...selectedNote,
                      title: e.target.value,
                    })
                  }
                  onBlur={() =>
                    updateNote(selectedNote.id, {
                      title: selectedNote.title,
                    })
                  }
                  className="w-full text-xl font-semibold outline-none"
                  placeholder="Note title"
                />
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
                    content={selectedNote.content}
                    onChange={(content) =>
                      setSelectedNote({ ...selectedNote, content })
                    }
                    onBlur={() =>
                      updateNote(selectedNote.id, {
                        content: selectedNote.content,
                      })
                    }
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">
                Select a note or create a new one
              </p>
            </div>
          )}
        </Card>

        {/* Backlinks and graph */}
        <Card className="h-[calc(100vh-200px)]">
          <Tabs defaultValue="backlinks" className="h-full">
            <div className="border-b p-2">
              <TabsList className="w-full">
                <TabsTrigger value="backlinks" className="flex-1 gap-2">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  Backlinks
                </TabsTrigger>
                <TabsTrigger value="graph" className="flex-1 gap-2">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  Graph
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="backlinks" className="h-full overflow-auto p-4">
              {backlinks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No backlinks
                </p>
              ) : (
                <div className="space-y-2">
                  {backlinks.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => {
                        const note = notes.find((n) => n.id === link.id);
                        if (note) setSelectedNote(note);
                      }}
                      aria-label={`Open linked note: ${link.title}`}
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm font-medium">
                          {link.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="graph" className="h-full p-4">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <div className="animate-pulse text-sm text-muted-foreground">
                      Loading graph...
                    </div>
                  </div>
                }
              >
                <NoteGraph notes={notes} />
              </Suspense>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
