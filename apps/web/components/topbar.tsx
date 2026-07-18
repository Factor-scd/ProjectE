'use client';

import { Search, Bell, Plus, Menu } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/lib/stores/use-sidebar-store';
import { CommandPalette } from '@/components/command-palette';

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setMobileOpen } = useSidebarStore();
  const creation = pathname.startsWith('/projects')
    ? { href: '/projects?new=true', label: 'New project' }
    : pathname.startsWith('/habits')
      ? { href: '/habits?new=true', label: 'New habit' }
      : pathname.startsWith('/tasks')
        ? { href: '/tasks?new=true', label: 'New task' }
        : null;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-6" role="banner">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search / Command trigger */}
        <div className="flex-1 md:max-w-sm">
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'k', metaKey: true })
              );
            }}
            aria-label="Open search (Cmd+K)"
          >
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Search or jump to...
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (creation) {
                router.push(creation.href);
                return;
              }
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }}
            aria-label={creation ? `Create ${creation.label.toLowerCase()}` : 'Quick add'}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            {creation?.label ?? 'Quick add'}
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
