import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Add a memoized TitleInput component after NoteEditor
old = '''function NotesPage() {'''
new = '''// Memoized title input that doesn't re-render when parent re-renders
const TitleInput = memo(function TitleInput({ note, onSave }: { note: Note | null; onSave: (id: string, title: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = note?.title || '';
    }
  }, [note?.id]);

  return (
    <input
      ref={inputRef}
      key={note?.id || 'none'}
      defaultValue={note?.title || ''}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (note && e.target.value !== note.title) {
          onSave(note.id, e.target.value);
        }
      }}
      className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
});

function NotesPage() {'''

content = content.replace(old, new, 1)

# Replace the title input section
old_title = '''              <input
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
              />'''

new_title = '''              <TitleInput
                note={selectedNote}
                onSave={(id, title) => {
                  updateMutation.mutate({ id, data: { title } });
                  setSelectedNote({ ...selectedNote, title } as Note);
                }}
              />'''

content = content.replace(old_title, new_title, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
