import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListTodo,
  Flame,
  FolderKanban,
  NotebookPen,
  CalendarDays,
  Share2,
  Settings,
  Bot,
  FileBarChart,
  Inbox,
  Plus,
  Sun,
  Moon,
  Key,
  Globe,
  Tag,
  List,
  Webhook,
  Upload,
} from "lucide-react";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";
import { useThemeStore } from "@/lib/stores/use-theme-store";

export interface Command {
  id: string;
  title: string;
  keywords: string[];
  icon: LucideIcon;
  category: "navigation" | "create" | "theme" | "settings" | "help";
  run: (ctx: CommandContext) => void;
  shortcut?: string;
}

export interface CommandContext {
  navigate: (opts: { to: string }) => void;
}

function navigateTo(path: string) {
  return (ctx: CommandContext) => ctx.navigate({ to: path });
}

function navigateToSettingsTab(tab: string) {
  return (ctx: CommandContext) => {
    ctx.navigate({ to: "/settings" });
    // Dispatch after navigation so the settings page is mounted
    requestAnimationFrame(() => {
      document.dispatchEvent(new CustomEvent("open-settings-tab", { detail: tab }));
    });
  };
}

function openCreate(type: "task" | "habit" | "project" | "note" | "event", path: string) {
  return (ctx: CommandContext) => {
    useCreateDialogStore.getState().openCreate(type);
    ctx.navigate({ to: path });
  };
}

function toggleTheme() {
  return (_ctx: CommandContext) => {
    const { mode, setMode } = useThemeStore.getState();
    setMode(mode === "dark" ? "light" : "dark");
  };
}

function dispatchEvent(eventName: string) {
  return (_ctx: CommandContext) => {
    document.dispatchEvent(new CustomEvent(eventName));
  };
}

export const commands: Command[] = [
  // ── Navigation ─────────────────────────────────────────────────────────
  {
    id: "nav-inbox",
    title: "Go to Inbox",
    keywords: ["inbox", "messages", "notifications"],
    icon: Inbox,
    category: "navigation",
    run: navigateTo("/inbox"),
    shortcut: "g+i",
  },
  {
    id: "nav-dashboard",
    title: "Go to Dashboard",
    keywords: ["dashboard", "home", "overview"],
    icon: LayoutDashboard,
    category: "navigation",
    run: navigateTo("/"),
    shortcut: "g+d",
  },
  {
    id: "nav-tasks",
    title: "Go to Tasks",
    keywords: ["tasks", "todo", "list"],
    icon: ListTodo,
    category: "navigation",
    run: navigateTo("/tasks"),
    shortcut: "g+t",
  },
  {
    id: "nav-habits",
    title: "Go to Habits",
    keywords: ["habits", "streaks", "tracker"],
    icon: Flame,
    category: "navigation",
    run: navigateTo("/habits"),
    shortcut: "g+h",
  },
  {
    id: "nav-projects",
    title: "Go to Projects",
    keywords: ["projects", "workspaces"],
    icon: FolderKanban,
    category: "navigation",
    run: navigateTo("/projects"),
    shortcut: "g+p",
  },
  {
    id: "nav-notes",
    title: "Go to Notes",
    keywords: ["notes", "documents", "wiki"],
    icon: NotebookPen,
    category: "navigation",
    run: navigateTo("/notes"),
    shortcut: "g+n",
  },
  {
    id: "nav-calendar",
    title: "Go to Calendar",
    keywords: ["calendar", "events", "schedule"],
    icon: CalendarDays,
    category: "navigation",
    run: navigateTo("/calendar"),
    shortcut: "g+c",
  },
  {
    id: "nav-graph",
    title: "Go to Graph",
    keywords: ["graph", "knowledge", "network", "connections"],
    icon: Share2,
    category: "navigation",
    run: navigateTo("/graph"),
    shortcut: "g+g",
  },
  {
    id: "nav-reports",
    title: "Go to Reports",
    keywords: ["reports", "analytics", "stats"],
    icon: FileBarChart,
    category: "navigation",
    run: navigateTo("/reports"),
    shortcut: "g+r",
  },
  {
    id: "nav-settings",
    title: "Go to Settings",
    keywords: ["settings", "preferences", "config"],
    icon: Settings,
    category: "navigation",
    run: navigateTo("/settings"),
    shortcut: "g+s",
  },
  {
    id: "nav-agents-activity",
    title: "Go to Agent Activity",
    keywords: ["agents", "activity", "logs"],
    icon: Bot,
    category: "navigation",
    run: navigateTo("/agents/activity"),
  },

  // ── Create ─────────────────────────────────────────────────────────────
  {
    id: "create-task",
    title: "New Task",
    keywords: ["task", "todo", "new", "create"],
    icon: ListTodo,
    category: "create",
    run: openCreate("task", "/tasks"),
    shortcut: "n+t",
  },
  {
    id: "create-habit",
    title: "New Habit",
    keywords: ["habit", "streak", "new", "create"],
    icon: Flame,
    category: "create",
    run: openCreate("habit", "/habits"),
    shortcut: "n+h",
  },
  {
    id: "create-project",
    title: "New Project",
    keywords: ["project", "new", "create"],
    icon: FolderKanban,
    category: "create",
    run: openCreate("project", "/projects"),
    shortcut: "n+p",
  },
  {
    id: "create-note",
    title: "New Note",
    keywords: ["note", "document", "new", "create"],
    icon: NotebookPen,
    category: "create",
    run: openCreate("note", "/notes"),
    shortcut: "n+n",
  },
  {
    id: "create-event",
    title: "New Event",
    keywords: ["event", "calendar", "new", "create"],
    icon: CalendarDays,
    category: "create",
    run: openCreate("event", "/calendar"),
  },

  // ── Theme ──────────────────────────────────────────────────────────────
  {
    id: "theme-toggle",
    title: "Toggle Light/Dark Mode",
    keywords: ["theme", "dark", "light", "mode", "appearance"],
    icon: Moon,
    category: "theme",
    run: toggleTheme(),
  },

  // ── Settings tabs ──────────────────────────────────────────────────────
  {
    id: "settings-appearance",
    title: "Open Appearance Settings",
    keywords: ["appearance", "theme", "font", "density"],
    icon: Sun,
    category: "settings",
    run: navigateToSettingsTab("appearance"),
  },
  {
    id: "settings-domains",
    title: "Open Domains Settings",
    keywords: ["domains", "workspaces"],
    icon: Globe,
    category: "settings",
    run: navigateToSettingsTab("domains"),
  },
  {
    id: "settings-tags",
    title: "Open Tags Settings",
    keywords: ["tags", "labels"],
    icon: Tag,
    category: "settings",
    run: navigateToSettingsTab("tags"),
  },
  {
    id: "settings-custom-fields",
    title: "Open Custom Fields Settings",
    keywords: ["custom", "fields", "schema"],
    icon: List,
    category: "settings",
    run: navigateToSettingsTab("custom-fields"),
  },
  {
    id: "settings-shortcuts",
    title: "Open Keyboard Shortcuts Settings",
    keywords: ["keyboard", "shortcuts", "bindings", "keys"],
    icon: Key,
    category: "settings",
    run: navigateToSettingsTab("shortcuts"),
  },
  {
    id: "settings-agents",
    title: "Open Agents Settings",
    keywords: ["agents", "permissions", "api"],
    icon: Bot,
    category: "settings",
    run: navigateToSettingsTab("agents"),
  },
  {
    id: "settings-webhooks",
    title: "Open Webhooks Settings",
    keywords: ["webhooks", "integrations"],
    icon: Webhook,
    category: "settings",
    run: navigateToSettingsTab("webhooks"),
  },
  {
    id: "settings-import-export",
    title: "Open Import/Export Settings",
    keywords: ["import", "export", "backup", "data"],
    icon: Upload,
    category: "settings",
    run: navigateToSettingsTab("import-export"),
  },

  // ── Help ───────────────────────────────────────────────────────────────
  {
    id: "help-shortcuts",
    title: "Show Keyboard Shortcuts",
    keywords: ["shortcuts", "help", "keys", "bindings"],
    icon: Key,
    category: "help",
    run: dispatchEvent("open-shortcuts-help"),
  },
  {
    id: "open-palette",
    title: "Open Command Palette",
    keywords: ["palette", "command", "search"],
    icon: Plus,
    category: "help",
    run: dispatchEvent("open-command-palette"),
  },
];
