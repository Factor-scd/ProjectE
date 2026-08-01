import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const shortcutGroups = [
  {
    heading: "Navigation",
    shortcuts: [
      { keys: "g then d", description: "Go to Dashboard" },
      { keys: "g then t", description: "Go to Tasks" },
      { keys: "g then h", description: "Go to Habits" },
      { keys: "g then p", description: "Go to Projects" },
      { keys: "g then n", description: "Go to Notes" },
      { keys: "g then c", description: "Go to Calendar" },
      { keys: "g then g", description: "Go to Graph" },
      { keys: "g then s", description: "Go to Settings" },
    ],
  },
  {
    heading: "General",
    shortcuts: [
      { keys: "⌘K / Ctrl+K", description: "Open command palette" },
      { keys: "/", description: "Focus search" },
      { keys: "?", description: "Show this help" },
      { keys: "Esc", description: "Close dialogs / panels" },
    ],
  },
  {
    heading: "Command Palette",
    shortcuts: [
      { keys: "↑↓", description: "Navigate items" },
      { keys: "Enter", description: "Select item" },
      { keys: "Esc", description: "Close palette" },
    ],
  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-shortcuts-help", handler);
    return () => document.removeEventListener("open-shortcuts-help", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.heading}>
              <h4 className="mb-2 text-sm font-semibold text-muted-foreground">
                {group.heading}
              </h4>
              <div className="space-y-2">
                {group.shortcuts.map((s) => (
                  <div
                    key={s.keys}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{s.description}</span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
