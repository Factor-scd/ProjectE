import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Remove all setEditorContent calls
content = content.replace('      setEditorContent("");\n', '', 1)
content = content.replace('      setEditorContent(detail.content || "");\n', '', 1)
content = content.replace('      setEditorContent(note.content || "");\n', '', 1)

# Remove editorContent state
content = content.replace('  const [editorContent, setEditorContent] = useState("");\n', '', 1)

# Remove saveTimerRef
content = content.replace('  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n', '', 1)

# Remove selectedNoteRef
content = content.replace('  const selectedNoteRef = useRef<Note | null>(null);\n', '', 1)

# Remove selectedNoteRef.current assignments
content = content.replace('      selectedNoteRef.current = detail;\n', '', 1)
content = content.replace('      selectedNoteRef.current = note;\n', '', 1)
content = content.replace('      selectedNoteRef.current = note;\n', '', 1)

# Remove handleContentChange
old = '''  const handleContentChange = useCallback((html: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const note = selectedNoteRef.current;
      if (note) {
        updateMutation.mutate({ id: note.id, data: { content: html } });
      }
    }, 500);
  }, [updateMutation]);'''

content = content.replace(old, '', 1)

# Update NoteEditor usage
old_editor = '              <NoteEditor key={selectedNote?.id || \'none\'} initialContent={editorContent} onSave={handleContentChange} />'
new_editor = '              <NoteEditor key={selectedNote?.id || \'none\'} initialContent={selectedNote?.content || \'\'} onSave={(html) => { if (selectedNote) { updateMutation.mutate({ id: selectedNote.id, data: { content: html } }); } }} />'
content = content.replace(old_editor, new_editor, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
