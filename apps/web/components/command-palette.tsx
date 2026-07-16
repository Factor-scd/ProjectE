'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ListTodo,
  Flame,
  FolderKanban,
  NotebookPen,
  FileBarChart,
  CalendarDays,
  BarChart3,
  Bot,
  Settings,
  Plus,
  Search,
  type LucideIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'Habits', href: '/habits', icon: Flame },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Notes', href: '/notes', icon: NotebookPen },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Agent Activity', href: '/agents', icon: Bot },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface QuickAction {
  label: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deepSearch, setDeepSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{
    type: string;
    items: Array<{ id: string; title: string }>;
  }>>([]);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          setDeepSearch(true);
          setOpen(true);
        } else {
          setDeepSearch(false);
          setOpen(true);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Quick actions
  const quickActions: QuickAction[] = [
    { label: 'New task', shortcut: 'N', action: () => router.push('/tasks?new=true') },
    { label: 'New habit', action: () => router.push('/habits?new=true') },
    { label: 'New project', action: () => router.push('/projects?new=true') },
    { label: 'New note', action: () => router.push('/notes?new=true') },
    { label: 'New report', action: () => router.push('/reports?new=true') },
  ];

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // Ignore search errors
    }
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={deepSearch ? 'max-w-2xl' : 'max-w-lg'}
    >
      <CommandInput
        placeholder={deepSearch ? 'Search everything...' : 'Type a command or search...'}
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation */}
        {!deepSearch && (
          <CommandGroup heading="Jump to">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => router.push(item.href))}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Quick actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(action.action)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {action.label}
              {action.shortcut && (
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {action.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Search Results (deep search mode) */}
        {deepSearch && searchResults.length > 0 && (
          <>
            <CommandSeparator />
            {searchResults.map((group) => (
              <CommandGroup key={group.type} heading={group.type}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      const typeRoute =
                        group.type === 'tasks' ? '/tasks' :
                        group.type === 'habits' ? '/habits' :
                        group.type === 'projects' ? '/projects' :
                        group.type === 'notes' ? '/notes' :
                        '/reports';
                      runCommand(() => router.push(`${typeRoute}/${item.id}`));
                    }}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            <kbd className="rounded border bg-muted px-1">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1">↵</kbd> select
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1">esc</kbd> close
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
