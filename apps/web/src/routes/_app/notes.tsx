import { useState, useCallback, useRef, useEffect, memo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { Plus, Trash2, Search, Pin, Archive, FileText, Link as LinkIcon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Note, PaginatedResponse } from "@/lib/types";

// Simple TipTap-like editor using contentEditable
const NoteEditor = memo(function NoteEditor({ initialContent, onSave, placeholder = "Start writing..." }: { initialContent: string; onSave: (html: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(!initialContent);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent || "";
    }
    setIsPlaceholder(!initialContent);
  }, [initialContent]);

  const handleBlur = () => {
    const html = editorRef.current?.innerHTML || "";
    onSave(html);
  };

  return (
    <div className="relative min-h-[300px]">
      {isPlaceholder && (
        <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none p-3 text-sm">{placeholder}</div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="prose prose-sm dark:prose-invert max-w-none p-3 focus:outline-none min-h-[300px]"
        onBlur={handleBlur}
      />
    </div>
  );
});

// Separate component for title input to prevent focus stealing on parent re-render
const NoteTitleInput = memo(function NoteTitleInput({ noteId, initialTitle }: { noteId: string; initialTitle: string }) {
  const [localTitle, setLocalTitle] = useState(initialTitle);
  const queryClient = useQueryClient();

  useEffect(() => {
    setLocalTitle(initialTitle);
  }, [initialTitle, noteId]);

  const handleBlur = () => {
    if (localTitle !== initialTitle) {
      api.patch<Note>(/notes/ + noteId, { title: localTitle }).then(() => {
        queryClient.invalidateQueries({ queryKey: [notes] });
      });
    }
  };

  return (
    <input
      value={localTitle}
      onChange={(e) => setLocalTitle(e.target.value)}
      onBlur={handleBlur}
      className=flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50
    />
  );
});

function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  useRealtime({ enabled: true });

  const { data: notesData, isLoading } = useApiQuery<PaginatedResponse<Note>>(
    ["notes", search],
    "/notes?limit=200" + (search ? "&search=" + encodeURIComponent(search) : "")
  );

  const notes = notesData?.items || [];

  const createMutation = useMutation({
    mutationFn: () => api.post<Note>("/notes", { title: "Untitled", content: "" }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedNote(note);
      setEditorContent("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<Note>("/notes/" + id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["notes"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/notes/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedNote(null);
    },
  });

  const selectNote = async (note: Note) => {
    try {
      const detail = await api.get<Note>("/notes/" + note.id);
      setSelectedNote(detail);
      setTitleDraft(detail.title);
      setEditorContent(detail.content || "");
    } catch {
      setSelectedNote(note);
      setTitleDraft(note.title);
      setEditorContent(note.content || "");
    }
    setShowBacklinks(false);
    setShowVersions(false);
  };

  const selectedNoteRef = useRef(selectedNote);
  selectedNoteRef.current = selectedNote;

  const handleContentChange = useCallback((html: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const note = selectedNoteRef.current;
      if (note) {
        updateMutation.mutate({ id: note.id, data: { content: html } });
      }
    }, 500);
  }, [updateMutation]);


  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 md:-m-6">
      {/* Left pane - note list */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                    selectedNote?.id === note.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
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
        </ScrollArea>
      </div>

      {/* Right pane - editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="flex items-center gap-2 p-3 border-b">
              <input
                key={selectedNote?.id || 'none'}
                defaultValue={selectedNote?.title || ''}
                onMouseDown={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  if (selectedNote && e.target.value !== selectedNote.title) {
                    updateMutation.mutate({ id: selectedNote.id, data: { title: e.target.value } });
                    setSelectedNote({ ...selectedNote, title: e.target.value });
                  }
                }}
                className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowBacklinks(!showBacklinks)} aria-label="Backlinks">
                  <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowVersions(!showVersions)} aria-label="Version history">
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
                      <AlertDialogDescription>Are you sure you want to delete "{selectedNote.title}"?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(selectedNote.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <NoteEditor initialContent={editorContent} onSave={handleContentChange} />
            </div>
            {/* Backlinks section */}
            {showBacklinks && selectedNote.backlinks && selectedNote.backlinks.length > 0 && (
              <div className="border-t p-3">
                <h4 className="text-sm font-semibold mb-2">Linked from</h4>
                <div className="space-y-1">
                  {selectedNote.backlinks.map((bl) => (
                    <div key={bl.noteId} className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                      {bl.noteTitle}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Version history */}
            {showVersions && (
              <div className="border-t p-3">
                <h4 className="text-sm font-semibold mb-2">Version History</h4>
                <p className="text-xs text-muted-foreground">Version history available via API.</p>
              </div>
            )}
          </>
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
