import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Shortcut {
  key: string;
  description: string;
  action: string;
  enabled: boolean;
}

interface KeyboardShortcutsState {
  enabled: boolean;
  shortcuts: Shortcut[];

  setEnabled: (enabled: boolean) => void;
  updateShortcut: (key: string, updates: Partial<Shortcut>) => void;
  resetShortcuts: () => void;
}

const defaultShortcuts: Shortcut[] = [
  { key: "g+d", description: "Go to Dashboard", action: "navigate_dashboard", enabled: true },
  { key: "g+t", description: "Go to Tasks", action: "navigate_tasks", enabled: true },
  { key: "g+h", description: "Go to Habits", action: "navigate_habits", enabled: true },
  { key: "g+p", description: "Go to Projects", action: "navigate_projects", enabled: true },
  { key: "g+n", description: "Go to Notes", action: "navigate_notes", enabled: true },
  { key: "g+c", description: "Go to Calendar", action: "navigate_calendar", enabled: true },
  { key: "g+g", description: "Go to Graph", action: "navigate_graph", enabled: true },
  { key: "g+s", description: "Go to Settings", action: "navigate_settings", enabled: true },
  { key: "/", description: "Focus search", action: "focus_search", enabled: true },
  { key: "?", description: "Show shortcuts help", action: "show_help", enabled: true },
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
      name: "project-e-keyboard-shortcuts",
    }
  )
);
