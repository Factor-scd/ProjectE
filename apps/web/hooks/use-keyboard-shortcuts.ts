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
        if (key === 'r') { router.push('/reports'); e.preventDefault(); return; }
        if (key === 'c') { router.push('/calendar'); e.preventDefault(); return; }
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
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router, enabled, shortcuts]);
}
