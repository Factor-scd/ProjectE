'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcutsStore } from '@/lib/stores/use-keyboard-shortcuts-store';

export function useKeyboardShortcuts() {
  const router = useRouter();
  const { shortcuts, enabled } = useKeyboardShortcutsStore();

  useEffect(() => {
    if (!enabled) return;

    let pendingKey = '';
    let pendingTimeout: ReturnType<typeof setTimeout>;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Never override native behavior inside controls or modal UI.
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except for our shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle two-key combos (G then letter)
      if (pendingKey) {
        clearTimeout(pendingTimeout);
        pendingKey = '';

        if (key === 'd') { router.push('/dashboard'); e.preventDefault(); return; }
        if (key === 't') { router.push('/tasks'); e.preventDefault(); return; }
        if (key === 'h') { router.push('/habits'); e.preventDefault(); return; }
        if (key === 'p') { router.push('/projects'); e.preventDefault(); return; }
        if (key === 'n') { router.push('/notes'); e.preventDefault(); return; }
        if (key === 'g') { router.push('/graph'); e.preventDefault(); return; }
        if (key === 'r') { router.push('/reports'); e.preventDefault(); return; }
        if (key === 'c') { router.push('/calendar'); e.preventDefault(); return; }
        if (key === 's') { router.push('/search'); e.preventDefault(); return; }
        if (key === 'a') { router.push('/analytics'); e.preventDefault(); return; }
        return;
      }

      // Single key shortcuts
      switch (key) {
        case 'g':
          pendingKey = 'g';
          pendingTimeout = setTimeout(() => { pendingKey = ''; }, 1000);
          e.preventDefault();
          break;
        case '/':
          // Focus search
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          e.preventDefault();
          break;
        case 'n':
          // New (context-dependent)
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          e.preventDefault();
          break;
        case 'c': {
          // c t — new task (Cmd palette → "New task")
          // Check if we're on the tasks page
          if (window.location.pathname.startsWith('/tasks')) {
            document.dispatchEvent(new CustomEvent('open-create-task', { detail: { status: 'todo' } }));
            e.preventDefault();
          }
          // c h — new habit
          if (window.location.pathname.startsWith('/habits')) {
            document.dispatchEvent(new CustomEvent('open-create-habit'));
            e.preventDefault();
          }
          // c p — new project
          if (window.location.pathname.startsWith('/projects')) {
            document.dispatchEvent(new CustomEvent('open-create-project'));
            e.preventDefault();
          }
          // c n — new note
          if (window.location.pathname.startsWith('/notes')) {
            document.dispatchEvent(new CustomEvent('open-create-note'));
            e.preventDefault();
          }
          // c s — new section (on project detail page)
          if (window.location.pathname.match(/^\/projects\/[^/]+$/)) {
            document.dispatchEvent(new CustomEvent('open-create-section'));
            e.preventDefault();
          }
          break;
        }
        case 'e': {
          // e — edit selected task (when task is focused)
          const focusedTask = document.querySelector('[data-task-id]:focus');
          if (focusedTask) {
            (focusedTask as HTMLElement).click();
            e.preventDefault();
          }
          break;
        }
        case 'd': {
          // d — delete selected task
          const deleteBtn = document.querySelector('[data-delete-task]');
          if (deleteBtn) {
            (deleteBtn as HTMLElement).click();
            e.preventDefault();
          }
          break;
        }
        case ' ': {
          // Space — open task detail panel
          const firstTask = document.querySelector('[data-task-id]');
          if (firstTask && window.location.pathname.startsWith('/tasks')) {
            (firstTask as HTMLElement).click();
            e.preventDefault();
          }
          break;
        }
        case 'escape': {
          // Esc — close detail panel
          const closeBtn = document.querySelector('[data-close-panel]');
          if (closeBtn) {
            (closeBtn as HTMLElement).click();
            e.preventDefault();
          }
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4': {
          // 1/2/3/4 — filter kanban column
          if (window.location.pathname.startsWith('/tasks')) {
            const statuses: Record<string, string> = { '1': 'todo', '2': 'in_progress', '3': 'done', '4': 'cancelled' };
            document.dispatchEvent(new CustomEvent('filter-kanban', { detail: { status: statuses[key] } }));
            e.preventDefault();
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, enabled, shortcuts]);
}
