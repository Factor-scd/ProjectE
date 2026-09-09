import { useState, useRef, useEffect, memo, useCallback } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { Plus, Trash2, Search, Pin, FileText, Link as LinkIcon, History } from "lucide-react";
import { NoteEditor } from "@/components/entities/note-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Note, PaginatedResponse } from "@/lib/types";
import { format, parseISO } from "date-fns";

// Completely uncontrolled title input - uses ref to avoid any re-render
const NoteTitleInput = memo(function NoteTitleInput({ noteId, initialTitle }: { noteId: string; initialTitle: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = initialTitle;
    }
  }, [initialTitle, noteId]);

  const handleBlur = () => {
    const newTitle = inputRef.current?.value || "";
    if (newTitle !== initialTitle) {
      api.patch<Note>("/notes/" + noteId, { title: newTitle }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["notes"] });
      });
    }
  };

  return (
    <input
      ref={inputRef}
      defaultValue={initialTitle}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={handleBlur}
      autoFocus
      className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
});

// Count words in HTML content (rough estimate)
function countWords(html: string | null): number {
  if (!html) return 0;
  return html.replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length;
}

// Memoized right pane - only re-renders when note changes, not on parent re-renders
const NoteEditorPane = memo(function NoteEditorPane({ note, onDelete, onOpenNote }: { note: Note; onDelete: (id: string) => void; onOpenNote: (note: Note) => void }) {
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<{ id: string; createdAt: string; action?: string; changes?: Record<string, unknown> | null }[]>([]);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<Note>("/notes/" + id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notes"] }); },
  });

  const handleSave = useCallback((html: string) => {
    updateMutation.mutate({ id: note.id, data: { content: html } });
  }, [note.id, updateMutation]);

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <NoteTitleInput key={note.id} noteId={note.id} initialTitle={note.title} />
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowBacklinks(!showBacklinks)} aria-label="Backlinks">
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowVersions(!showVersions); if (!showVersions) { api.get<{ items: { id: string; createdAt: string; action?: string; changes?: Record<string, unknown> | null }[] }>("/notes/" + note.id + "/versions").then((data) => setVersions(data.items || [])).catch(() => setVersions([])); } }} aria-label="Version history">
            <History className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Delete note">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Note</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete "{note.title}"?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {/* Metadata strip */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b text-xs text-muted-foreground">
        <span className="font-mono">{format(parseISO(note.updatedAt), "yyyy-MM-dd HH:mm")}</span>
        <span className="text-border">·</span>
        <span className="font-mono">{countWords(note.content)} words</span>
        {note.isPinned && (
          <>
            <span className="text-border">·</span>
            <span className="font-mono text-amber-500">pinned</span>
          </>
        )}
        {note.tags && note.tags.length > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="font-mono">{note.tags.length} tag{note.tags.length !== 1 ? 's' : ''}</span>
          </>
        )}
        {note.backlinks && note.backlinks.length > 0 && (
          <>
            <span className="text-border">·</span>
            <span className="font-mono">{note.backlinks.length} backlink{note.backlinks.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <NoteEditor key={note.id} initialContent={note.content || ''} onSave={handleSave} />
      </div>
      {/* Backlinks section */}
      {showBacklinks && note.backlinks && note.backlinks.length > 0 && (
        <div className="border-t px-3 py-2">
          <h4 className="text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Linked from</h4>
          <div className="space-y-0.5">
            {note.backlinks.map((bl) => (
              <div
                key={bl.id}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5"
                onClick={() => { const linked: Note = { ...note, id: bl.id, title: bl.title }; onOpenNote(linked); }}
              >
                <LinkIcon className="h-3 w-3 shrink-0" />
                {bl.title}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Version history */}
      {showVersions && (
        <div className="border-t px-3 py-2">
          <h4 className="text-xs font-semibold mb-1 uppercase tracking-wider text-muted-foreground">Version History</h4>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-0.5">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{format(parseISO(v.createdAt), "yyyy-MM-dd HH:mm")}</span>
                  {v.action && <Badge variant="secondary" className="text-[10px] capitalize font-mono">{v.action}</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
});

function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const selectedNoteRef = useRef<Note | null>(null);

  useRealtime({ enabled: true });

  useOpenCreateDialog("note", () => createMutation.mutate());

  const activeDomainId = useApiDomain();

  const notesQueryUrl = () =>
    "/notes?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "") + (search ? "&search=" + encodeURIComponent(search) : "");

  const { data: notesData, isLoading } = useApiQuery<PaginatedResponse<Note>>(
    ["notes", activeDomainId, search],
    notesQueryUrl()
  );

  const notes = notesData?.items || [];
  const hasMoreNotes = notes.length < (notesData?.totalItems || 0);
  const [loadingMoreNotes, setLoadingMoreNotes] = useState(false);

  const loadMoreNotes = async () => {
    if (!hasMoreNotes || loadingMoreNotes) return;
    setLoadingMoreNotes(true);
    try {
      const next = await api.get<PaginatedResponse<Note>>(notesQueryUrl() + "&offset=" + notes.length);
      queryClient.setQueryData<PaginatedResponse<Note>>(["notes", activeDomainId, search], (old) => {
        if (!old) return old;
        const seen = new Set(old.items.map((n) => n.id));
        return { ...old, items: [...old.items, ...next.items.filter((n) => !seen.has(n.id))] };
      });
    } finally {
      setLoadingMoreNotes(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => api.post<Note>("/notes", { title: "Untitled", content: "", ...(activeDomainId ? { domain: activeDomainId } : {}) }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      selectedNoteRef.current = note;
      setSelectedNoteId(note.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/notes/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      selectedNoteRef.current = null;
      setSelectedNoteId(null);
    },
  });

  const selectNote = async (note: Note) => {
    try {
      const detail = await api.get<Note>("/notes/" + note.id);
      selectedNoteRef.current = detail;
    } catch {
      selectedNoteRef.current = note;
    }
    setSelectedNoteId(note.id);
  };

  const selectedNote = selectedNoteRef.current;

  const handleDeleteNote = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return (
    <div className="flex flex-col md:flex-row h-auto min-h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Left pane - note list */}
      <div className="w-full md:w-72 h-64 md:h-auto border-b md:border-b-0 md:border-r flex flex-col shrink-0">
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" aria-label="Search notes" />
          </div>
        </div>
        <div className="px-3 py-2 border-b">
          <Button size="sm" className="w-full h-8 text-xs" onClick={() => createMutation.mutate()} aria-label="New note">
            <Plus className="h-3.5 w-3.5 mr-1" />New Note
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              <p className="text-xs text-muted-foreground">No notes yet</p>
            </div>
          ) : (
            <div>
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm transition-colors border-b border-border/50 last:border-b-0",
                    selectedNoteId === note.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
                    <span className="truncate font-medium text-xs">{note.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground font-mono">
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>{countWords(note.content)}w</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {hasMoreNotes && (
            <div className="px-3 py-1.5">
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={loadMoreNotes} disabled={loadingMoreNotes}>
                {loadingMoreNotes ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right pane - editor (memoized, won't re-render on parent state changes) */}
      <div className="flex-1 flex flex-col min-h-64 md:min-h-0">
        {selectedNote ? (
          <NoteEditorPane key={selectedNote.id} note={selectedNote} onDelete={handleDeleteNote} onOpenNote={selectNote} />
        ) : (
          <div className="flex items-center justify-center flex-1 text-muted-foreground">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-amber-400" />
              <p className="text-sm text-muted-foreground">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes",
  component: NotesPage,
});
