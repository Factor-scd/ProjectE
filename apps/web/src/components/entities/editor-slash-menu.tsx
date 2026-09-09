import { useState, useEffect } from "react";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { cn } from "@/lib/utils";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";

interface SlashCommandItem {
  title: string;
  description?: string;
  command: (props: { editor: any; range: any }) => void;
}

function SlashCommandList({
  items,
  command,
  onClose,
}: {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  onClose: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (e.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === "Enter") {
        command(items[selectedIndex]);
        return true;
      }
      if (e.key === "Escape") {
        onClose();
        return true;
      }
      return false;
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [items, selectedIndex, command, onClose]);

  if (items.length === 0) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
        <div className="px-3 py-1.5 text-sm text-muted-foreground">
          No results
        </div>
      </div>
    );
  }

  return (
    <div className="bg-popover border rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
      {items.map((item, i) => (
        <button
          key={item.title}
          className={cn(
            "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
            i === selectedIndex && "bg-accent"
          )}
          onClick={() => command(item)}
        >
          <span className="font-medium">{item.title}</span>
          {item.description && (
            <span className="text-xs text-muted-foreground ml-2">
              {item.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const allCommands: SlashCommandItem[] = [
  {
    title: "Heading 1",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 1 })
        .run();
    },
  },
  {
    title: "Heading 2",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 2 })
        .run();
    },
  },
  {
    title: "Heading 3",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level: 3 })
        .run();
    },
  },
  {
    title: "Bullet List",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Todo List",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Code Block",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Wikilink",
    description: "Link to a note",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent("[[").run();
    },
  },
];

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        command: ({ editor, range, props }: any) =>
          props.command({ editor, range }),
        items: ({ query }: { query: string }) =>
          allCommands.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase())
          ),
        render: () => {
          let component: ReactRenderer;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  ...props,
                  onClose: () => {
                    props.editor.chain().focus().run();
                  },
                },
                editor: props.editor,
              });

              unmount = props.mount(component.element);
            },

            onUpdate: (props: any) => {
              component.updateProps(props);
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                unmount?.();
                component?.destroy();
                return true;
              }
              return false;
            },

            onExit: () => {
              unmount?.();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
