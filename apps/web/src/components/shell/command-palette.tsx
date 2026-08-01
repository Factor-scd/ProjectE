import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListTodo,
  Flame,
  FolderKanban,
  NotebookPen,
  Share2,
  CalendarDays,
  Bot,
  Settings,
  Plus,
  Search,
  Sun,
  Moon,
  Palette,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useThemeStore, type AccentColor, ACCENT_PALETTE } from "@/lib/stores/use-theme-store";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Habits", href: "/habits", icon: Flame },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Notes", href: "/notes", icon: NotebookPen },
  { label: "Graph", href: "/graph", icon: Share2 },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Agent Activity", href: "/agents/activity", icon: Bot },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface QuickAction {
  label: string;
  icon: LucideIcon;
  action: () => void;
}

// Recent items store (last 5 visited pages)
const RECENT_KEY = "project-e-recent-pages";
function getRecentPages(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function addRecentPage(href: string) {
  const recent = getRecentPages().filter((p) => p !== href);
  recent.unshift(href);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 5)));
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { mode, setMode, accent, setAccent } = useThemeStore();
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ type: string; items: Array<{ id: string; title: string }> }>
  >([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Listen for open-command-palette event
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-command-palette", handler);
    return () => document.removeEventListener("open-command-palette", handler);
  }, []);

  // Track page navigation for recent items
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== "/login") addRecentPage(path);
  }, []);

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      label: "New task",
      icon: ListTodo,
      action: () => navigate({ to: "/tasks" }),
    },
    {
      label: "New habit",
      icon: Flame,
      action: () => navigate({ to: "/habits" }),
    },
    {
      label: "New project",
      icon: FolderKanban,
      action: () => navigate({ to: "/projects" }),
    },
    {
      label: "New note",
      icon: NotebookPen,
      action: () => navigate({ to: "/notes" }),
    },
    {
      label: "New event",
      icon: CalendarDays,
      action: () => navigate({ to: "/calendar" }),
    },
  ];

  // Theme actions
  const themeActions: QuickAction[] = [
    {
      label: mode === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: mode === "dark" ? Sun : Moon,
      action: () => setMode(mode === "dark" ? "light" : "dark"),
    },
    ...(Object.entries(ACCENT_PALETTE) as [AccentColor, { name: string; hsl: string }][]).map(
      ([key, val]) => ({
        label: `Accent: ${val.name}`,
        icon: Palette,
        action: () => setAccent(key),
      })
    ),
  ];

  // Settings actions
  const settingsActions: QuickAction[] = [
    {
      label: "Log out",
      icon: LogOut,
      action: () => {
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          window.location.href = "/login";
        });
      },
    },
  ];

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Check for @mention
    if (query.startsWith("@")) {
      const mentionQuery = query.slice(1).trim();
      if (mentionQuery) {
        try {
          const res = await fetch(`/api/agents?q=${encodeURIComponent(mentionQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults([
              {
                type: "Agents",
                items: (data.agents || data.results || []).map((a: { id: string; name: string }) => ({
                  id: a.id,
                  title: a.name,
                })),
              },
            ]);
          }
        } catch {
          // Ignore
        }
      }
      return;
    }

    // Debounced API search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {
        // Ignore search errors
      }
    }, 300);
  }, []);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    []
  );

  // Recent pages
  const recentPages = getRecentPages();
  const recentNavItems = recentPages
    .map((href) => navItems.find((item) => item.href === href))
    .filter(Boolean) as NavItem[];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={isMobile ? "max-w-full h-full rounded-none border-0" : "max-w-lg"}
    >
      <CommandInput
        placeholder="Type a command or search..."
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent items */}
        {recentNavItems.length > 0 && (
          <CommandGroup heading="Recent">
            {recentNavItems.map((item) => (
              <CommandItem
                key={item.href}
                onSelect={() => runCommand(() => navigate({ to: item.href }))}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Navigation */}
        <CommandGroup heading="Jump to">
          {navItems.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => runCommand(() => navigate({ to: item.href }))}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Quick Actions */}
        <CommandGroup heading="Create">
          {quickActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(action.action)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Theme */}
        <CommandGroup heading="Theme">
          {themeActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(action.action)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Settings */}
        <CommandGroup heading="Settings">
          {settingsActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(action.action)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <>
            <CommandSeparator />
            {searchResults.map((group) => (
              <CommandGroup key={group.type} heading={group.type}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => {
                      const typeRoute =
                        group.type === "tasks"
                          ? "/tasks"
                          : group.type === "habits"
                          ? "/habits"
                          : group.type === "projects"
                          ? "/projects"
                          : group.type === "notes"
                          ? "/notes"
                          : "/search";
                      runCommand(() => navigate({ to: `${typeRoute}/${item.id}` }));
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
