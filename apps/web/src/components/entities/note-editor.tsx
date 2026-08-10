import { memo, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

const AUTOSAVE_DEBOUNCE_MS = 800;

// TipTap-based note editor. Autosaves with a debounce (plus a save-on-blur and a
// flush-on-unmount safety net) and deliberately does NOT stop propagation of
// key/mouse events, so global shortcuts (command palette, etc.) keep working.
export const NoteEditor = memo(function NoteEditor({
  initialContent,
  onSave,
  placeholder = "Start writing...",
}: {
  initialContent: string;
  onSave: (html: string) => void;
  placeholder?: string;
}) {
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
