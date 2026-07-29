'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Plus, FileText, Link2, GitBranch, Trash2, Pin, Archive, Search, PinOff, ArchiveRestore } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { NoteTemplates } from '@/components/notes/note-templates';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Lazy load TipTap editor
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
  domainId: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: { id: string; name: string; color: string | null }[];
}

interface BacklinkItem {
  id: string;
  title: string;
  excerpt: string;
}

interface OutgoingLink {
  noteLinks: { id: string; title: string }[];
  entityLinks: { entityType: string; entityId: string; title: string | null }[];
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [outgoingLinks, setOutgoingLinks] = useState<OutgoingLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Failed'>('Saved');
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pinned' | 'archived'>('all');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveVersion = useRef(0);
  const pendingSave = useRef<{ id: string; updates: Partial<Note> } | null>(null);

  // Fetch domains on mount
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

  // Fetch notes when domain or filter changes
  useEffect(() => {
    if (domainId) {
      fetchNotes();
    }
  }, [domainId, filterMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch backlinks when selected note changes
  useEffect(() => {
    if (selectedNote) {
      fetchBacklinks(selectedNote.id);
      fetchOutgoingLinks(selectedNote.id);
    }
  }, [selectedNote]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNotes() {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterMode === 'pinned') params.set('pinned', 'true');
      else if (filterMode === 'archived') params.set('archived', 'true');
      else params.set('archived', 'false');
      if (searchQuery) params.set('search', searchQuery);
      params.set('sort', 'updated_at');
      params.set('order', 'desc');

      const response = await fetch(`/api/domains/${domainId}/notes?${params}`);
      if (!response.ok) throw new Error('Unable to load notes.');
      const data = await response.json();
      const notesList = data.items || [];
      setNotes(notesList);
      if (!selectedNote && notesList.length > 0) {
        setSelectedNote(notesList[0]);
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setError('Unable to load notes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBacklinks(noteId: string) {
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/notes/${noteId}/backlinks`);
      if (!response.ok) throw new Error('Unable to load backlinks.');
      const data = await response.json();
      setBacklinks(data.items || []);
    } catch (error) {
      console.error('Failed to fetch backlinks:', error);
      setBacklinks([]);
    }
  }

  async function fetchOutgoingLinks(noteId: string) {
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/notes/${noteId}`);
      if (!response.ok) throw new Error('Unable to load note.');
      const data = await response.json();
      setOutgoingLinks(data.outgoingLinks || null);
    } catch (error) {
      console.error('Failed to fetch outgoing links:', error);
      setOutgoingLinks(null);
    }
  }

  async function createNoteWithContent(content: string) {
    if (!domainId) return;
    try {
      const response = await fetch("/api/domains/" + domainId + "/notes", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled note',
          content,
        }),
      });
      if (!response.ok) throw new Error('Unable to create note.');
      const newNote = await response.json();
      setNotes((current) => [newNote, ...current]);
      setSelectedNote(newNote);
      toast.success('Note created from template');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Unable to create note');
    }
  }

  async function createNote() {
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled note',
          content: '',
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
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Unable to save note.');
      const updated = await response.json();
      setNotes((current) => current.map((note) => (note.id === noteId ? { ...note, ...updated } : note)));
      if (saveVersion.current === version) setSaveStatus('Saved');
    } catch (error) {
      console.error('Failed to update note:', error);
      if (saveVersion.current === version) setSaveStatus('Failed');
      toast.error('Unable to save note');
    }
  }

  async function deleteNote() {
    if (!noteToDelete || !domainId) return;
    if (pendingSave.current?.id === noteToDelete.id && saveTimer.current) {
      clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }
    ++saveVersion.current;
    setDeleting(true);
    try {
      const response = await fetch(`/api/domains/${domainId}/notes/${noteToDelete.id}`, { method: 'DELETE' });
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

  async function togglePinned(note: Note) {
    const newPinned = !note.isPinned;
    setSelectedNote((prev) => prev?.id === note.id ? { ...prev, isPinned: newPinned } : prev);
    setNotes((current) => current.map((n) => n.id === note.id ? { ...n, isPinned: newPinned } : n));
    await updateNote(note.id, { isPinned: newPinned }, ++saveVersion.current);
    toast.success(newPinned ? 'Note pinned' : 'Note unpinned');
  }

  async function toggleArchived(note: Note) {
    const newArchived = !note.isArchived;
    setSelectedNote((prev) => prev?.id === note.id ? { ...prev, isArchived: newArchived } : prev);
    setNotes((current) => current.map((n) => n.id === note.id ? { ...n, isArchived: newArchived } : n));
    await updateNote(note.id, { isArchived: newArchived }, ++saveVersion.current);
    toast.success(newArchived ? 'Note archived' : 'Note restored');
  }

  async function openBacklink(link: BacklinkItem) {
    const existing = notes.find((note) => note.id === link.id);
    if (existing) return setSelectedNote(existing);
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/notes/${link.id}`);
      if (!response.ok) throw new Error('Unable to load linked note.');
      const note = await response.json() as Note;
      setNotes((current) => [note, ...current]);
      setSelectedNote(note);
    } catch (error) {
      console.error('Failed to fetch linked note:', error);
      toast.error('Unable to open linked note');
    }
  }

  const handleRefresh = useCallback(() => {
    fetchNotes();
  }, [domainId, filterMode, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter notes locally for search
  const filteredNotes = notes.filter((note) => {
    if (searchQuery && !note.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading && notes.length === 0) {
    return <p className="text-muted-foreground" role="status">Loading notes...</p>;
  }

  if (error && notes.length === 0) {
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
          <NoteTemplates onCreateFromTemplate={(content) => {
            createNoteWithContent(content);
          }} />
          <Button onClick={createNote}>
            <Plus className="mr-2 h-4 w-4" />
            New note
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* Notes list */}
        <Card className="max-h-80 lg:h-[calc(100vh-200px)] lg:max-h-none">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="mt-2 flex gap-1">
              <Button
                variant={filterMode === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterMode('all')}
              >
                All
              </Button>
              <Button
                variant={filterMode === 'pinned' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterMode('pinned')}
              >
                <Pin className="mr-1 h-3 w-3" />
                Pinned
              </Button>
              <Button
                variant={filterMode === 'archived' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilterMode('archived')}
              >
                <Archive className="mr-1 h-3 w-3" />
                Archived
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-80 lg:h-[calc(100vh-260px)] lg:max-h-none">
            <div className="p-2">
              {filteredNotes.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No notes found</p>
                  <Button className="mt-3" size="sm" onClick={createNote}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first note
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNotes.map((note) => (
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
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">
                              {note.title}
                            </p>
                            {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                            {note.isArchived && <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
                          {note.tags && note.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {note.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag.id} variant="outline" className="text-[10px] px-1.5 py-0">
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                      setSelectedNote({ ...selectedNote, title });
                      scheduleSave(selectedNote.id, { title });
                    }}
                    className="min-w-0 flex-1 text-xl font-semibold outline-none"
                    placeholder="Note title"
                  />
                  <span className="text-xs text-muted-foreground" role="status">{saveStatus}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => togglePinned(selectedNote)}
                    aria-label={selectedNote.isPinned ? 'Unpin note' : 'Pin note'}
                  >
                    <Pin className={`h-4 w-4 ${selectedNote.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleArchived(selectedNote)}
                    aria-label={selectedNote.isArchived ? 'Restore note' : 'Archive note'}
                  >
                    {selectedNote.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
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
                    content={selectedNote.content || ''}
                    onChange={(content) => {
                      setSelectedNote({ ...selectedNote, content });
                      scheduleSave(selectedNote.id, { content });
                    }}
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

        {/* Backlinks and outgoing links panel */}
        <Card className="min-h-[360px] lg:h-[calc(100vh-200px)]">
          <Tabs defaultValue="backlinks" className="h-full">
            <div className="border-b p-2">
              <TabsList className="w-full">
                <TabsTrigger value="backlinks" className="flex-1 gap-2">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  Backlinks ({backlinks.length})
                </TabsTrigger>
                <TabsTrigger value="outgoing" className="flex-1 gap-2">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  Links
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="backlinks" className="h-full overflow-auto p-4">
              {backlinks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No backlinks — no other notes link to this one
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
                        <span className="text-sm font-medium">{link.title}</span>
                      </div>
                      {link.excerpt && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{link.excerpt}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="outgoing" className="h-full overflow-auto p-4">
              {!outgoingLinks ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
              ) : outgoingLinks.noteLinks.length === 0 && outgoingLinks.entityLinks.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No outgoing links — use [[Title]] to link to other notes
                </p>
              ) : (
                <div className="space-y-3">
                  {outgoingLinks.noteLinks.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                      {outgoingLinks.noteLinks.map((link) => (
                        <button
                          key={link.id}
                          onClick={() => openBacklink({ id: link.id, title: link.title, excerpt: '' })}
                          className="w-full rounded-lg border p-2 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <FileText className="mr-2 inline h-3 w-3 text-muted-foreground" />
                          {link.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {outgoingLinks.entityLinks.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entities</p>
                      {outgoingLinks.entityLinks.map((link, i) => (
                        <div key={`${link.entityType}-${link.entityId}-${i}`} className="rounded-lg border p-2 text-sm">
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor:
                                link.entityType === 'task' ? '#3b82f6' :
                                link.entityType === 'habit' ? '#10b981' :
                                link.entityType === 'project' ? '#8b5cf6' :
                                link.entityType === 'section' ? '#ec4899' :
                                link.entityType === 'tag' ? '#6b7280' : '#f59e0b',
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{link.entityType}:</span>{' '}
                          {link.title || link.entityId.slice(0, 8)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
