import sys

with open(sys.argv[1], 'r') as f:
    content = f.read()

# Replace NoteEditor to use ref-based onChange (no re-render on keystroke)
old_editor = '''const NoteEditor = memo(function NoteEditor({ content, onChange, placeholder = "Start writing..." }: { content: string; onChange: (html: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(!content);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content || "";
    }
  }, [content]);

  const handleInput = () => {
    const html = editorRef.current?.innerHTML || "";
    setIsPlaceholder(!html || html === "<br>");
    onChange(html);
  };

  return (
    <div className="relative min-h-[300px]">
      {isPlaceholder && (
        <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none p-3 text-sm">{placeholder}</div>
      )}
      <div
        ref={editorRef}
        contentEditable
        className="prose prose-sm dark:prose-invert max-w-none p-3 focus:outline-none min-h-[300px]"
        onInput={handleInput}
        suppressContentEditableWarning
      />
    </div>
  );
});'''

new_editor = '''const NoteEditor = memo(function NoteEditor({ content, onChange, placeholder = "Start writing..." }: { content: string; onChange: (html: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [isPlaceholder, setIsPlaceholder] = useState(!content);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = content || "";
    }
  }, [content]);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || "";
    setIsPlaceholder(!html || html === "<br>");
    onChangeRef.current(html);
  }, []);

  return (
    <div className="relative min-h-[300px]">
      {isPlaceholder && (
        <div className="absolute top-0 left-0 text-muted-foreground pointer-events-none p-3 text-sm">{placeholder}</div>
      )}
      <div
        ref={editorRef}
        contentEditable
        className="prose prose-sm dark:prose-invert max-w-none p-3 focus:outline-none min-h-[300px]"
        onInput={handleInput}
        suppressContentEditableWarning
      />
    </div>
  );
});'''

content = content.replace(old_editor, new_editor, 1)

with open(sys.argv[1], 'w') as f:
    f.write(content)
print('Done')
