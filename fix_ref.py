import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

old = '''function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
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
    } catch {
      setSelectedNote(note);
    }
    setShowBacklinks(false);
    setShowVersions(false);
  };

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
              <NoteTitleInput key={selectedNote.id} noteId={selectedNote.id} initialTitle={selectedNote.title} />
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
              <NoteEditor key={selectedNote?.id || 'none'} initialContent={selectedNote?.content || ''} onSave={(html) => { if (selectedNote) { updateMutation.mutate({ id: selectedNote.id, data: { content: html } }); } }} />
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
}'''

new = '''function NotesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showBacklinks, setShowBacklinks] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const selectedNoteRef = useRef<Note | null>(null);

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
      selectedNoteRef.current = note;
      setSelectedNoteId(note.id);
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
    setShowBacklinks(false);
    setShowVersions(false);
  };

  const selectedNote = selectedNoteRef.current;

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
        </ScrollArea>
      </div>

      {/* Right pane - editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="flex items-center gap-2 p-3 border-b">
              <NoteTitleInput key={selectedNote.id} noteId={selectedNote.id} initialTitle={selectedNote.title} />
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
              <NoteEditor key={selectedNote.id} initialContent={selectedNote.content || ''} onSave={(html) => { if (selectedNoteRef.current) { updateMutation.mutate({ id: selectedNoteRef.current.id, data: { content: html } }); } }} />
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
}'''

content = content.replace(old, new, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
