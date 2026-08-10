import { useState, useRef, useEffect, memo, useCallback } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { Plus, Trash2, Search, Pin, FileText, Link as LinkIcon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Note, PaginatedResponse } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

const AUTOSAVE_DEBOUNCE_MS = 800;

// TipTap-based note editor. Autosaves with a debounce (plus a save-on-blur and a
// flush-on-unmount safety net) and deliberately does NOT stop propagation of
// key/mouse events, so global shortcuts (command palette, etc.) keep working.
const NoteEditor = memo(function NoteEditor({ initialContent, onSave, placeholder = "Start writing..." }: { initialContent: string; onSave: (html: string) => void; placeholder?: string }) {
  const latestHtmlRef = useRef(initialContent || "");
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: false }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder }),
      ],
      content: initialContent || "",
      editorProps: {
        attributes: {
          class: "focus:outline-none min-h-[300px] p-3",
        },
      },
    },
    [placeholder, initialContent]
  );

  useEffect(() => {
    if (!editor) return;

    const flushSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      onSave(latestHtmlRef.current);
    };

    const handleUpdate = () => {
      latestHtmlRef.current = editor.getHTML();
      dirtyRef.current = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flushSave, AUTOSAVE_DEBOUNCE_MS);
    };

    editor.on("update", handleUpdate);
    editor.on("blur", flushSave);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("blur", flushSave);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Flush any unsaved edits on unmount so switching notes doesn't drop typing.
      if (dirtyRef.current) {
        dirtyRef.current = false;
        onSave(latestHtmlRef.current);
      }
    };
  }, [editor, onSave]);

  if (!editor) return null;

  return (
    <div className="note-editor relative min-h-[300px]">
      {/* Placeholder needs its ::before styling; the @tailwindcss/typography plugin
          is not installed, so this is scoped CSS for the empty-editor state. */}
      <style>{`
        .note-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
});

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
      className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
});

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
      <div className="flex items-center gap-2 p-3 border-b">
        <NoteTitleInput key={note.id} noteId={note.id} initialTitle={note.title} />
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowBacklinks(!showBacklinks)} aria-label="Backlinks">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowVersions(!showVersions); if (!showVersions) { api.get<{ items: { id: string; createdAt: string; action?: string; changes?: Record<string, unknown> | null }[] }>("/notes/" + note.id + "/versions").then((data) => setVersions(data.items || [])).catch(() => setVersions([])); } }} aria-label="Version history">
            <History className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete note">
                <Trash2 className="h-4 w-4" />
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
      <div className="flex-1 overflow-auto">
        <NoteEditor key={note.id} initialContent={note.content || ''} onSave={handleSave} />
      </div>
      {/* Backlinks section */}
      {showBacklinks && note.backlinks && note.backlinks.length > 0 && (
        <div className="border-t p-3">
          <h4 className="text-sm font-semibold mb-2">Linked from</h4>
          <div className="space-y-1">
            {note.backlinks.map((bl) => (
              <div
                key={bl.id}
                className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => { const linked: Note = { ...note, id: bl.id, title: bl.title }; onOpenNote(linked); }}
              >
                {bl.title}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Version history */}
      {showVersions && (
        <div className="border-t p-3">
          <h4 className="text-sm font-semibold mb-2">Version History</h4>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions yet.</p>
          ) : (
            <div className="space-y-1">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(parseISO(v.createdAt), "MMM d, yyyy HH:mm")}</span>
                  {v.action && <Badge variant="secondary" className="text-[10px] capitalize">{v.action}</Badge>}
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
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" aria-label="Search notes" />
          </div>
        </div>
        <div className="p-2">
          <Button size="sm" className="w-full" onClick={() => createMutation.mutate()} aria-label="New note">
            <Plus className="h-4 w-4 mr-2" />New Note
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No notes yet.</div>
          ) : (
            <div className="space-y-0.5 p-2">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => selectNote(note)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    selectedNoteId === note.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <span className="truncate font-medium">{note.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
          {hasMoreNotes && (
            <div className="p-2">
              <Button variant="outline" size="sm" className="w-full" onClick={loadMoreNotes} disabled={loadingMoreNotes}>
                {loadingMoreNotes ? "Loading..." : "Load more notes"}
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
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a note or create a new one</p>
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
