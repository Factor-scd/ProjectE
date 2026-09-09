import { memo, useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { SlashCommand } from "./editor-slash-menu";
import { cn } from "@/lib/utils";

const AUTOSAVE_DEBOUNCE_MS = 800;

interface WikilinkSearchResult {
  id: string;
  title: string;
}

function WikilinkPopover({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (title: string) => void;
  onClose: () => void;
}) {
  const [results, setResults] = useState<WikilinkSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
    if (!query) {
      setResults([]);
      return;
    }
    const abort = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}&types=note&limit=8`, {
      credentials: "include",
      signal: abort.signal,
    })
      .then((r) => r.json())
      .then((data) => setResults(data?.items || []))
      .catch(() => {});
    return () => abort.abort();
  }, [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i + results.length - 1) % results.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % results.length);
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        onSelect(results[selectedIndex].title);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [results, selectedIndex, onSelect, onClose]);

  if (results.length === 0 && !query) return null;

  return (
    <div className="absolute z-50 bg-popover border rounded-lg shadow-lg py-1 max-h-60 overflow-auto w-64">
      {results.length === 0 ? (
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          No notes found
        </div>
      ) : (
        results.map((r, i) => (
          <button
            key={r.id}
            className={cn(
              "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
              i === selectedIndex && "bg-accent"
            )}
            onClick={() => onSelect(r.title)}
          >
            {r.title}
          </button>
        ))
      )}
    </div>
  );
}

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
  const [wikilinkOpen, setWikilinkOpen] = useState(false);
  const [wikilinkQuery, setWikilinkQuery] = useState("");
  const wikilinkRangeRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: false }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder }),
        SlashCommand,
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

    // Wikilink detection: listen for [[ input and track query text
    const handleWikilinkInput = () => {
      const { state } = editor;
      const { from } = state.selection;
      
      if (wikilinkOpen && wikilinkRangeRef.current) {
        // Update the query as user types after [[
        const queryText = state.doc.textBetween(
          wikilinkRangeRef.current.from + 2,
          from,
          "\n"
        );
        setWikilinkQuery(queryText);
        // Close if user deleted the [[ 
        if (!queryText && from <= wikilinkRangeRef.current.from + 2) {
          const textBefore = state.doc.textBetween(Math.max(0, from - 2), from, "\n");
          if (textBefore !== "[[") {
            setWikilinkOpen(false);
            wikilinkRangeRef.current = null;
          }
        }
      } else {
        // Detect new [[ opening
        const textBefore = state.doc.textBetween(Math.max(0, from - 2), from, "\n");
        if (textBefore === "[[") {
          wikilinkRangeRef.current = { from: from - 2, to: from };
          setWikilinkOpen(true);
          setWikilinkQuery("");
        }
      }
    };

    editor.on("update", handleWikilinkInput);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("blur", flushSave);
      editor.off("update", handleWikilinkInput);
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
  }, [editor, onSave, wikilinkOpen]);

  const handleWikilinkSelect = useCallback(
    (title: string) => {
      if (!editor || !wikilinkRangeRef.current) return;
      const { from, to } = wikilinkRangeRef.current;
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContent(`[[${title}]]`)
        .run();
      setWikilinkOpen(false);
      setWikilinkQuery("");
      wikilinkRangeRef.current = null;
    },
    [editor]
  );

  const handleWikilinkClose = useCallback(() => {
    setWikilinkOpen(false);
    setWikilinkQuery("");
    wikilinkRangeRef.current = null;
  }, []);

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
      {wikilinkOpen && (
        <WikilinkPopover
          query={wikilinkQuery}
          onSelect={handleWikilinkSelect}
          onClose={handleWikilinkClose}
        />
      )}
    </div>
  );
});
