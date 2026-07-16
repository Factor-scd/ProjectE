'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useKeyboardShortcutsStore } from '@/lib/stores/use-keyboard-shortcuts-store';

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const { shortcuts } = useKeyboardShortcutsStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        setOpen((prev) => !prev);
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border bg-muted px-1">?</kbd> to toggle this help
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Navigation</h2>
            <div className="space-y-1">
              {shortcuts
                .filter((s) => s.action.startsWith('navigate_'))
                .map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Actions</h2>
            <div className="space-y-1">
              {shortcuts
                .filter((s) => !s.action.startsWith('navigate_'))
                .map((shortcut) => (
                  <div key={shortcut.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{shortcut.description}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-mono">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
