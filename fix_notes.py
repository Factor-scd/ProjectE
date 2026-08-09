import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Replace the title input section to use uncontrolled input with ref
old_title_section = '''            <div className="flex items-center gap-2 p-3 border-b">
              <Input
                value={titleDraft}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                className="text-lg font-semibold border-0 focus-visible:ring-0 px-0"
              />'''

new_title_section = '''            <div className="flex items-center gap-2 p-3 border-b">
              <input
                key={selectedNote?.id || 'none'}
                defaultValue={selectedNote?.title || ''}
                onBlur={(e) => {
                  if (selectedNote && e.target.value !== selectedNote.title) {
                    updateMutation.mutate({ id: selectedNote.id, data: { title: e.target.value } });
                    setSelectedNote({ ...selectedNote, title: e.target.value });
                  }
                }}
                className="flex h-9 w-full rounded-md border-0 bg-transparent px-0 py-1 text-lg font-semibold text-base shadow-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
              />'''

content = content.replace(old_title_section, new_title_section, 1)

# Remove unused handleTitleChange and handleTitleBlur
old_handle = '''  const handleTitleChange = (title: string) => {
    setTitleDraft(title);
  };

  const handleTitleBlur = () => {
    if (selectedNote && titleDraft !== selectedNote.title) {
      updateMutation.mutate({ id: selectedNote.id, data: { title: titleDraft } });
      setSelectedNote({ ...selectedNote, title: titleDraft });
    }
  };
'''
content = content.replace(old_handle, '', 1)

# Remove unused titleDraft state
content = content.replace('  const [titleDraft, setTitleDraft] = useState("");\n', '', 1)

# Remove unused titleTimerRef
content = content.replace('  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n', '', 1)

# Remove setTitleDraft calls from selectNote
content = content.replace('      setTitleDraft(detail.title);\n', '', 1)
content = content.replace('      setTitleDraft(note.title);\n', '', 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
