import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Shortcut {
  key: string;
  description: string;
  action: string;
  enabled: boolean;
}

interface KeyboardShortcutsState {
  enabled: boolean;
  shortcuts: Shortcut[];

  // Actions
  setEnabled: (enabled: boolean) => void;
  updateShortcut: (key: string, updates: Partial<Shortcut>) => void;
  resetShortcuts: () => void;
}

const defaultShortcuts: Shortcut[] = [
  { key: 'g+d', description: 'Go to Dashboard', action: 'navigate_dashboard', enabled: true },
  { key: 'g+t', description: 'Go to Tasks', action: 'navigate_tasks', enabled: true },
  { key: 'g+h', description: 'Go to Habits', action: 'navigate_habits', enabled: true },
  { key: 'g+p', description: 'Go to Projects', action: 'navigate_projects', enabled: true },
  { key: 'g+n', description: 'Go to Notes', action: 'navigate_notes', enabled: true },
  { key: 'g+r', description: 'Go to Reports', action: 'navigate_reports', enabled: true },
  { key: 'g+c', description: 'Go to Calendar', action: 'navigate_calendar', enabled: true },
  { key: 'g+a', description: 'Go to Analytics', action: 'navigate_analytics', enabled: true },
  { key: '/', description: 'Focus search', action: 'focus_search', enabled: true },
  { key: 'n', description: 'Quick add', action: 'quick_add', enabled: true },
  { key: '?', description: 'Show shortcuts help', action: 'show_help', enabled: true },
  { key: 'j', description: 'Move down', action: 'move_down', enabled: true },
  { key: 'k', description: 'Move up', action: 'move_up', enabled: true },
  { key: 'enter', description: 'Open selected', action: 'open', enabled: true },
  { key: 'e', description: 'Edit selected', action: 'edit', enabled: true },
  { key: 'space', description: 'Toggle complete', action: 'toggle_complete', enabled: true },
  { key: 'c', description: 'Complete selected', action: 'complete', enabled: true },
  { key: 'x', description: 'Cancel', action: 'cancel', enabled: true },
];

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState>()(
  persist(
    (set) => ({
      enabled: true,
      shortcuts: defaultShortcuts,

      setEnabled: (enabled) => set({ enabled }),
      updateShortcut: (key, updates) =>
        set((state) => ({
          shortcuts: state.shortcuts.map((s) =>
            s.key === key ? { ...s, ...updates } : s
          ),
        })),
      resetShortcuts: () => set({ shortcuts: defaultShortcuts }),
    }),
    {
      name: 'project-e-keyboard-shortcuts',
    }
  )
);
