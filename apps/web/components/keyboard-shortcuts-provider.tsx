'use client';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { ShortcutsHelp } from '@/components/shortcuts-help';

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();

  return (
    <>
      {children}
      <ShortcutsHelp />
    </>
  );
}
