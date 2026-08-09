'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: '?', description: 'Open keyboard shortcuts help' },
      { keys: '⌘K', description: 'Open command palette' },
      { keys: '⌘⇧K', description: 'Deep search' },
      { keys: 'Esc', description: 'Close panel / dialog' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'G then D', description: 'Go to Dashboard' },
      { keys: 'G then T', description: 'Go to Tasks' },
      { keys: 'G then H', description: 'Go to Habits' },
      { keys: 'G then P', description: 'Go to Projects' },
      { keys: 'G then N', description: 'Go to Notes' },
      { keys: 'G then G', description: 'Go to Graph' },
      { keys: 'G then C', description: 'Go to Calendar' },
      { keys: 'G then S', description: 'Go to Search' },
      { keys: 'G then A', description: 'Go to Analytics' },
    ],
  },
  {
    title: 'Creation',
    shortcuts: [
      { keys: 'C (on tasks page)', description: 'New task' },
      { keys: 'C (on habits page)', description: 'New habit' },
      { keys: 'C (on projects page)', description: 'New project' },
      { keys: 'C (on notes page)', description: 'New note' },
      { keys: 'C (on project detail)', description: 'New section' },
    ],
  },
  {
    title: 'Entity Actions',
    shortcuts: [
      { keys: 'Space (on tasks)', description: 'Open first task detail' },
      { keys: 'E', description: 'Edit focused task' },
      { keys: 'D', description: 'Delete focused task' },
      { keys: '1-4 (on tasks)', description: 'Filter kanban column (todo→cancelled)' },
    ],
  },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Toggle with ? key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return shortcutGroups;
    const q = search.toLowerCase();
    return shortcutGroups
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          (s) =>
            s.keys.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.shortcuts.length > 0);
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            All available keyboard shortcuts for Project E.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search shortcuts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
          aria-label="Search shortcuts"
        />

        <ScrollArea className="flex-1 max-h-[50vh]">
          {filteredGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No shortcuts match your search.
            </p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.title} className="mb-6">
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>{shortcut.description}</span>
                      <kbd className="ml-4 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <kbd className="rounded border bg-muted px-1 font-mono">?</kbd> to toggle this overlay
        </p>
      </DialogContent>
    </Dialog>
  );
}
