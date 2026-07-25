'use client';

import { Search, Bell, Plus, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/lib/stores/use-sidebar-store';
import { useCreateDialogStore } from '@/lib/stores/use-create-dialog-store';
import { CommandPalette } from '@/components/command-palette';

export function TopBar() {
  const pathname = usePathname();
  const { setMobileOpen } = useSidebarStore();
  const openCreate = useCreateDialogStore((s) => s.openCreate);

  function handleCreate() {
    if (pathname.startsWith('/projects')) openCreate('project');
    else if (pathname.startsWith('/habits')) openCreate('habit');
    else if (pathname.startsWith('/tasks')) openCreate('task');
    else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    }
  }

  const label = pathname.startsWith('/projects') ? 'New project'
    : pathname.startsWith('/habits') ? 'New habit'
    : pathname.startsWith('/tasks') ? 'New task' : 'Quick add';

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-6" role="banner">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex-1 md:max-w-sm">
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))} aria-label="Open search (Cmd+K)">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Search or jump to... <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">⌘K</kbd>
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCreate} aria-label={label === 'Quick add' ? 'Quick add' : `Create ${label.toLowerCase()}`}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            {label}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <CommandPalette />
    </>
  );
}
