export interface ShortcutDefinition {
  id: string;
  defaultKeys: string; // @github/hotkey format
  description: string;
  category: "navigation" | "create" | "general" | "palette";
  commandId: string; // references a Command.id
}

export const shortcuts: ShortcutDefinition[] = [
  // ── Navigation (g+ sequences) ──────────────────────────────────────────
  {
    id: "nav-dashboard",
    defaultKeys: "g d",
    description: "Go to Dashboard",
    category: "navigation",
    commandId: "nav-dashboard",
  },
  {
    id: "nav-tasks",
    defaultKeys: "g t",
    description: "Go to Tasks",
    category: "navigation",
    commandId: "nav-tasks",
  },
  {
    id: "nav-habits",
    defaultKeys: "g h",
    description: "Go to Habits",
    category: "navigation",
    commandId: "nav-habits",
  },
  {
    id: "nav-projects",
    defaultKeys: "g p",
    description: "Go to Projects",
    category: "navigation",
    commandId: "nav-projects",
  },
  {
    id: "nav-notes",
    defaultKeys: "g n",
    description: "Go to Notes",
    category: "navigation",
    commandId: "nav-notes",
  },
  {
    id: "nav-calendar",
    defaultKeys: "g c",
    description: "Go to Calendar",
    category: "navigation",
    commandId: "nav-calendar",
  },
  {
    id: "nav-graph",
    defaultKeys: "g g",
    description: "Go to Graph",
    category: "navigation",
    commandId: "nav-graph",
  },
  {
    id: "nav-reports",
    defaultKeys: "g r",
    description: "Go to Reports",
    category: "navigation",
    commandId: "nav-reports",
  },
  {
    id: "nav-settings",
    defaultKeys: "g s",
    description: "Go to Settings",
    category: "navigation",
    commandId: "nav-settings",
  },
  {
    id: "nav-inbox",
    defaultKeys: "g i",
    description: "Go to Inbox",
    category: "navigation",
    commandId: "nav-inbox",
  },

  // ── Create (n+ sequences) ──────────────────────────────────────────────
  {
    id: "create-task",
    defaultKeys: "n t",
    description: "New Task",
    category: "create",
    commandId: "create-task",
  },
  {
    id: "create-habit",
    defaultKeys: "n h",
    description: "New Habit",
    category: "create",
    commandId: "create-habit",
  },
  {
    id: "create-project",
    defaultKeys: "n p",
    description: "New Project",
    category: "create",
    commandId: "create-project",
  },
  {
    id: "create-note",
    defaultKeys: "n n",
    description: "New Note",
    category: "create",
    commandId: "create-note",
  },

  // ── General ────────────────────────────────────────────────────────────
  {
    id: "help-shortcuts",
    defaultKeys: "?",
    description: "Show Keyboard Shortcuts",
    category: "general",
    commandId: "help-shortcuts",
  },

  // ── Palette ────────────────────────────────────────────────────────────
  {
    id: "palette-open",
    defaultKeys: "/",
    description: "Open Command Palette",
    category: "palette",
    commandId: "open-palette",
  },
  {
    id: "palette-open-c",
    defaultKeys: "c",
    description: "Open Command Palette",
    category: "palette",
    commandId: "open-palette",
  },
  {
    id: "palette-cmd-k",
    defaultKeys: "Meta+k",
    description: "Open Command Palette",
    category: "palette",
    commandId: "open-palette",
  },
  {
    id: "new-task-cmd-n",
    defaultKeys: "Meta+n",
    description: "New Task",
    category: "create",
    commandId: "create-task",
  },
];
