'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { Plus, FileText, Link2, GitBranch, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { DailyNoteButton } from '@/components/notes/daily-note-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  const [domainForCreate, setDomainForCreate] = useState('');
  const [domainOptions, setDomainOptions] = useState<{id: string; name: string}[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backlinksError, setBacklinksError] = useState<string | null>(null);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Failed'>('Saved');
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const createdFromQuery = useRef(false);
  const pendingSave = useRef<{ id: string; updates: Partial<Note> } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersion = useRef(0);

  useEffect(() => { fetchDomains();
    fetchNotes();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => { fetchDomains();
    if (new URLSearchParams(window.location.search).get('new') !== 'true' || createdFromQuery.current) return;
    createdFromQuery.current = true;
    createNote().finally(() => window.history.replaceState(null, '', '/notes'));
  // Route-triggered creation should only run once per page visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchDomains();
    if (selectedNote) {
      fetchBacklinks(selectedNote.id);
    }
  }, [selectedNote]);

  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
      if (res.ok) {
        const data = await res.json();
        setDomainOptions(data.items || []);
        if (data.items?.length > 0) setDomainForCreate(data.items[0].id);
      }
    } catch {}
  }

  async function fetchNotes() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notes?sort=-updated');
      if (!response.ok) throw new Error('Unable to load notes.');
      const data = await response.json();
      const notesList = data.items || [];
      setNotes(notesList);
      setSelectedNote((current) => current || notesList[0] || null);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setError('Unable to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBacklinks(noteId: string) {
    setBacklinksLoading(true);
    setBacklinksError(null);
    try {
      const response = await fetch(`/api/notes/${noteId}/backlinks`);
      if (!response.ok) throw new Error('Unable to load backlinks.');
      const data = await response.json();
      setBacklinks(data.items || []);
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
      setBacklinksError('Unable to load backlinks.');
    } finally {
      setBacklinksLoading(false);
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
          domain: domainForCreate,
        }),
      });
      if (!response.ok) throw new Error('Unable to create note.');
      const newNote = await response.json();
      setNotes((current) => [newNote, ...current]);
      setSelectedNote(newNote);
      toast.success('Note created');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Unable to create note');
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
    setNotes((current) => [note, ...current]);
    setSelectedNote(note);
  }

  function scheduleSave(noteId: string, updates: Partial<Note>) {
    const version = ++saveVersion.current;
    pendingSave.current = {
      id: noteId,
      updates: { ...(pendingSave.current?.id === noteId ? pendingSave.current.updates : {}), ...updates },
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('Saving');
    saveTimer.current = setTimeout(() => {
      const save = pendingSave.current;
      pendingSave.current = null;
      if (save) updateNote(save.id, save.updates, version);
    }, 700);
  }

  async function updateNote(noteId: string, updates: Partial<Note>, version: number) {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Unable to save note.');
      const updated = await response.json();
      setNotes((current) => current.map((note) => (note.id === noteId ? updated : note)));
      if (saveVersion.current === version) setSaveStatus('Saved');
    } catch (error) {
      console.error('Failed to update note:', error);
      if (saveVersion.current === version) setSaveStatus('Failed');
      toast.error('Unable to save note');
    }
  }

  async function deleteNote() {
    if (!noteToDelete) return;
    if (pendingSave.current?.id === noteToDelete.id && saveTimer.current) {
      clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }
    ++saveVersion.current;
    setDeleting(true);
    try {
      const response = await fetch(`/api/notes/${noteToDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete note.');
      setNotes((current) => current.filter((note) => note.id !== noteToDelete.id));
      setSelectedNote((selected) =>
        selected?.id === noteToDelete.id ? notes.find((note) => note.id !== noteToDelete.id) || null : selected
      );
      setNoteToDelete(null);
      toast.success('Note deleted');
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Unable to delete note');
    } finally {
      setDeleting(false);
    }
  }

  async function openBacklink(link: Backlink) {
    const existing = notes.find((note) => note.id === link.id);
    if (existing) return setSelectedNote(existing);
    try {
      const response = await fetch(`/api/notes/${link.id}`);
      if (!response.ok) throw new Error('Unable to load linked note.');
      const note = await response.json() as Note;
      setNotes((current) => [note, ...current]);
      setSelectedNote(note);
    } catch (error) {
      console.error('Failed to fetch linked note:', error);
      toast.error('Unable to open linked note');
    }
  }

  if (loading) {
    return <p className="text-muted-foreground" role="status">Loading notes...</p>;
  }

  if (error) {
    return <div className="space-y-3"><p className="text-muted-foreground" role="alert">{error}</p><Button onClick={fetchNotes}>Retry</Button></div>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <Card className="max-h-80 lg:h-[calc(100vh-200px)] lg:max-h-none">
          <ScrollArea className="max-h-80 lg:h-full lg:max-h-none">
            <div className="p-2">
              {notes.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                  <Button className="mt-3" size="sm" onClick={createNote}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first note
                  </Button>
                </div>
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
                            {domainOptions.find(d => d.id === note.domain)?.name || note.domain}
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
        <Card className="min-h-[420px] lg:h-[calc(100vh-200px)]">
          {selectedNote ? (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <label htmlFor="note-title" className="sr-only">
                  Note title
                </label>
                <div className="flex items-center gap-3">
                  <input
                  id="note-title"
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setSelectedNote({
                      ...selectedNote,
                      title,
                    });
                    scheduleSave(selectedNote.id, { title });
                  }}
                  className="min-w-0 flex-1 text-xl font-semibold outline-none"
                  placeholder="Note title"
                  />
                  <span className="text-xs text-muted-foreground" role="status">{saveStatus}</span>
                  <AlertDialog open={noteToDelete?.id === selectedNote.id} onOpenChange={(open) => !open && setNoteToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${selectedNote.title}`} onClick={() => setNoteToDelete(selectedNote)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete {noteToDelete?.title}?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this note.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteNote} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete note'}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
                    content={selectedNote.content}
                    onChange={(content) => { setSelectedNote({ ...selectedNote, content }); scheduleSave(selectedNote.id, { content }); }}
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
        <Card className="min-h-[360px] lg:h-[calc(100vh-200px)]">
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
              {backlinksLoading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading backlinks...</p> : backlinksError ? <div className="py-8 text-center"><p className="text-sm text-muted-foreground" role="alert">{backlinksError}</p><Button className="mt-3" size="sm" onClick={() => selectedNote && fetchBacklinks(selectedNote.id)}>Retry</Button></div> : backlinks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No backlinks
                </p>
              ) : (
                <div className="space-y-2">
                  {backlinks.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => openBacklink(link)}
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
