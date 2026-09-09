import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
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
  LogOut,
  Inbox,
  FileBarChart,
  Hash,
  ChevronRight,
  Clock,
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
import { Badge } from "@/components/ui/badge";
import { useThemeStore } from "@/lib/stores/use-theme-store";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useCommandStore } from "@/lib/commands";
import { useCommandHistoryStore } from "@/lib/stores/use-command-history-store";
import { parseTaskInput } from "@/lib/nlp";
import type { Command } from "@/lib/commands/registry";

// ─── Navigation ──────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Habits", href: "/habits", icon: Flame },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Notes", href: "/notes", icon: NotebookPen },
  { label: "Graph", href: "/graph", icon: Share2 },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Analytics", href: "/analytics", icon: LayoutDashboard },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Agent Activity", href: "/agents/activity", icon: Bot },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─── Recent pages (for empty state) ─────────────────────────────────────

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

// ─── Recent entities ─────────────────────────────────────────────────────

interface RecentEntity {
  id: string;
  title: string;
  type: string;
  link: string;
}

function getRecentEntities(): RecentEntity[] {
  try {
    return JSON.parse(localStorage.getItem("project-e-recent-entities") || "[]");
  } catch {
    return [];
  }
}

// ─── Fuzzy match ─────────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  const lower = query.toLowerCase();
  const target = text.toLowerCase();
  if (target.includes(lower)) return true;
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < lower.length; ti++) {
    if (target[ti] === lower[qi]) qi++;
  }
  return qi === lower.length;
}

// ─── Component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useThemeStore();
  const activeDomainId = useApiDomain();
  const { commands: registryCommands, run } = useCommandStore();
  const { record, getRecent } = useCommandHistoryStore();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ type: string; items: Array<{ id: string; title: string; link?: string }> }>
  >([]);
  const [agentResults, setAgentResults] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (location.pathname !== "/login") addRecentPage(location.pathname);
  }, [location.pathname]);

  // ─── Quick actions ────────────────────────────────────────────────────

  const quickActions = [
    {
      label: "New task",
      icon: ListTodo,
      action: () => {
        useCreateDialogStore.getState().openCreate("task");
        navigate({ to: "/tasks" });
      },
    },
    {
      label: "New habit",
      icon: Flame,
      action: () => {
        useCreateDialogStore.getState().openCreate("habit");
        navigate({ to: "/habits" });
      },
    },
    {
      label: "New project",
      icon: FolderKanban,
      action: () => {
        useCreateDialogStore.getState().openCreate("project");
        navigate({ to: "/projects" });
      },
    },
    {
      label: "New note",
      icon: NotebookPen,
      action: () => {
        useCreateDialogStore.getState().openCreate("note");
        navigate({ to: "/notes" });
      },
    },
    {
      label: "New event",
      icon: CalendarDays,
      action: () => {
        useCreateDialogStore.getState().openCreate("event");
        navigate({ to: "/calendar" });
      },
    },
  ];

  const themeActions = [
    {
      label: mode === "dark" ? "Switch to light mode" : "Switch to dark mode",
      icon: mode === "dark" ? Sun : Moon,
      action: () => setMode(mode === "dark" ? "light" : "dark"),
    },
  ];

  const settingsActions = [
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

  // ─── Input parsing ────────────────────────────────────────────────────

  const prefix = query.startsWith(">") || query.startsWith("#") || query.startsWith("@")
    ? query[0] as ">" | "#" | "@"
    : null;
  const rawInput = prefix ? query.slice(1).trim() : query.trim();
  const isEmpty = !query;
  const isCommandMode = prefix === ">";
  const isTagMode = prefix === "#";
  const isMentionMode = prefix === "@";

  // ─── Recent commands (top 5) ──────────────────────────────────────────

  const recentCommandIds = getRecent(5);
  const recentCommands = recentCommandIds
    .map((id) => registryCommands.find((c) => c.id === id))
    .filter(Boolean) as Command[];

  // ─── Matched commands (fuzzy on keywords) ─────────────────────────────

  const matchedCommands = rawInput
    ? registryCommands.filter((cmd) => {
        if (isCommandMode || (!prefix && rawInput)) {
          // Match on title, keywords, or id
          if (fuzzyMatch(rawInput, cmd.title)) return true;
          if (cmd.keywords?.some((kw: string) => fuzzyMatch(rawInput, kw))) return true;
          if (fuzzyMatch(rawInput, cmd.id)) return true;
        }
        return false;
      })
    : [];

  // ─── Create task item (NLP preview) ───────────────────────────────────

  const showCreateTask =
    rawInput.length > 0 &&
    !isCommandMode &&
    !isTagMode &&
    !isMentionMode;

  const parsedTask = showCreateTask ? parseTaskInput(rawInput) : null;

  const createTaskAction = useCallback(() => {
    if (!parsedTask) return;
    record("create-task-inline");
    useCreateDialogStore.getState().openCreate("task", {
      title: parsedTask.title,
      dueDate: parsedTask.dueDate || undefined,
      priority: parsedTask.priority || undefined,
      tags: parsedTask.tags,
    });
    navigate({ to: "/tasks" });
  }, [parsedTask, record, navigate]);

  // ─── Debounced API search ─────────────────────────────────────────────

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      const input = value.trim();
      if (!input || isCommandMode || isMentionMode) {
        setSearchResults([]);
        return;
      }

      // Tag mode: just search tags from the API
      if (isTagMode) {
        const tagQuery = rawInput;
        if (!tagQuery) {
          setSearchResults([]);
          return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await fetch(
              `/api/tags?q=${encodeURIComponent(tagQuery)}&limit=5` +
                (activeDomainId ? "&domain=" + activeDomainId : "")
            );
            if (res.ok) {
              const data = await res.json();
              setSearchResults([
                {
                  type: "Tags",
                  items: (data.items || []).map((t: { id: string; name: string }) => ({
                    id: t.id,
                    title: t.name,
                  })),
                },
              ]);
            }
          } catch {
            // Ignore
          }
        }, 300);
        return;
      }

      // Regular search (no prefix or bare phrase)
      if (!prefix || prefix === "#") {
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await fetch(
              `/api/search?q=${encodeURIComponent(input)}&limit=5` +
                (activeDomainId ? "&domain=" + activeDomainId : "")
            );
            if (res.ok) {
              const data = await res.json();
              const flat: Array<{
                type: string;
                id: string;
                title: string;
                link?: string;
              }> = data.results || [];
              const grouped: Record<
                string,
                Array<{ id: string; title: string; link?: string }>
              > = {};
              for (const r of flat) {
                const key =
                  r.type.charAt(0).toUpperCase() + r.type.slice(1) + "s";
                (grouped[key] = grouped[key] || []).push({
                  id: r.id,
                  title: r.title,
                  link: r.link,
                });
              }
              setSearchResults(
                Object.entries(grouped).map(([type, items]) => ({ type, items }))
              );
            }
          } catch {
            // Ignore search errors
          }
        }, 300);
      }
    },
    [activeDomainId, isCommandMode, isMentionMode, isTagMode, prefix, rawInput]
  );

  // ─── Agent mention search ─────────────────────────────────────────────

  useEffect(() => {
    if (!isMentionMode || !rawInput) {
      setAgentResults([]);
      return;
    }
    const controller = new AbortController();
    fetch(
      `/api/agents?q=${encodeURIComponent(rawInput)}` +
        (activeDomainId ? "&domain=" + activeDomainId : ""),
      { signal: controller.signal }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) setAgentResults(data.items);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isMentionMode, rawInput, activeDomainId]);

  // ─── Execute command ──────────────────────────────────────────────────

  const executeCommand = useCallback(
    (commandId: string) => {
      record(commandId);
      const cmd = registryCommands.find((c) => c.id === commandId);
      if (cmd) {
        setOpen(false);
        cmd.run({ navigate });
      }
    },
    [registryCommands, record, navigate]
  );

  const runQuickAction = useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    []
  );

  const runNav = useCallback(
    (href: string) => {
      setOpen(false);
      navigate({ to: href });
    },
    [navigate]
  );

  // ─── Recent pages (for empty state) ───────────────────────────────────

  const recentPages = getRecentPages();
  const recentNavItems = recentPages
    .map((href) => navItems.find((item) => item.href === href))
    .filter(Boolean) as NavItem[];

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className={isMobile ? "max-w-full h-full rounded-none border-0" : "max-w-lg"}
    >
      <CommandInput
        placeholder={
          isCommandMode
            ? "Search commands..."
            : isTagMode
              ? "Search tags..."
              : isMentionMode
                ? "Mention an agent..."
                : "Type a command or search..."
        }
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isCommandMode
            ? "No commands found."
            : isTagMode
              ? "No tags found."
              : isMentionMode
                ? "No agents found."
                : "No results found."}
        </CommandEmpty>

        {/* ─── Empty state (no input) ────────────────────────────────── */}
        {isEmpty && (
          <>
            {/* Recent pages */}
            {recentNavItems.length > 0 && (
              <CommandGroup heading="Recent">
                {recentNavItems.map((item) => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => runNav(item.href)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent entities */}
            {getRecentEntities().length > 0 && (
              <CommandGroup heading="Recent Entities">
                {getRecentEntities().slice(0, 3).map((entity) => (
                  <CommandItem
                    key={entity.id}
                    onSelect={() => runNav(entity.link)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    <span className="truncate">{entity.title}</span>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {entity.type}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent commands */}
            {recentCommands.length > 0 && (
              <CommandGroup heading="Recent Commands">
                {recentCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => executeCommand(cmd.id)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {cmd.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {/* Navigation */}
            <CommandGroup heading="Jump to">
              {navItems.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => runNav(item.href)}
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
                  onSelect={() => runQuickAction(action.action)}
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
                  onSelect={() => runQuickAction(action.action)}
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
                  onSelect={() => runQuickAction(action.action)}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* ─── Command mode (">" prefix) ────────────────────────────── */}
        {isCommandMode && (
          <CommandGroup heading="Commands">
            {matchedCommands.length > 0 ? (
              matchedCommands.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  onSelect={() => executeCommand(cmd.id)}
                >
                  {cmd.icon && <cmd.icon className="mr-2 h-4 w-4" />}
                  {!cmd.icon && <ChevronRight className="mr-2 h-4 w-4" />}
                  {cmd.title}
                  {cmd.keywords && cmd.keywords.length > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {cmd.keywords[0]}
                    </span>
                  )}
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>No commands match.</CommandEmpty>
            )}
          </CommandGroup>
        )}

        {/* ─── Tag mode ("#" prefix) ────────────────────────────────── */}
        {isTagMode && (
          <>
            {searchResults.length > 0 ? (
              searchResults.map((group) => (
                <CommandGroup key={group.type} heading={group.type}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.id}
                      onSelect={() => runNav(item.link || "/")}
                    >
                      <Hash className="mr-2 h-4 w-4" />
                      {item.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : rawInput ? (
              <CommandEmpty>No tags found.</CommandEmpty>
            ) : (
              <CommandGroup heading="Tags">
                <CommandEmpty>Type to search tags...</CommandEmpty>
              </CommandGroup>
            )}
          </>
        )}

        {/* ─── Agent mention ("@" prefix) ───────────────────────────── */}
        {isMentionMode && (
          <CommandGroup heading="Agents">
            {agentResults.length > 0 ? (
              agentResults.map((agent) => (
                <CommandItem
                  key={agent.id}
                  onSelect={() => {
                    record("mention-agent");
                    setOpen(false);
                  }}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  {agent.name}
                </CommandItem>
              ))
            ) : rawInput ? (
              <CommandEmpty>No agents found.</CommandEmpty>
            ) : (
              <CommandEmpty>Type to search agents...</CommandEmpty>
            )}
          </CommandGroup>
        )}

        {/* ─── Typing: no prefix — commands + search + create task ──── */}
        {!isEmpty && !prefix && (
          <>
            {/* Create task with NLP preview */}
            {showCreateTask && parsedTask && (
              <CommandGroup heading="Create">
                <CommandItem onSelect={createTaskAction}>
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="truncate">Create task: &apos;{parsedTask.title}&apos;</span>
                  <div className="ml-auto flex gap-1 shrink-0">
                    {parsedTask.dueDate && (
                      <Badge variant="secondary" className="text-[10px]">
                        {new Date(parsedTask.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </Badge>
                    )}
                    {parsedTask.priority && (
                      <Badge
                        variant="secondary"
                        className={
                          parsedTask.priority === "urgent"
                            ? "text-[10px] bg-red-500/10 text-red-600"
                            : parsedTask.priority === "high"
                              ? "text-[10px] bg-orange-500/10 text-orange-600"
                              : "text-[10px]"
                        }
                      >
                        {parsedTask.priority}
                      </Badge>
                    )}
                    {parsedTask.tags.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {parsedTask.tags[0]}
                        {parsedTask.tags.length > 1 && ` +${parsedTask.tags.length - 1}`}
                      </Badge>
                    )}
                  </div>
                </CommandItem>
              </CommandGroup>
            )}

            {/* Matched commands */}
            {matchedCommands.length > 0 && (
              <CommandGroup heading="Commands">
                {matchedCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => executeCommand(cmd.id)}
                  >
                    {cmd.icon && <cmd.icon className="mr-2 h-4 w-4" />}
                    {!cmd.icon && <ChevronRight className="mr-2 h-4 w-4" />}
                    {cmd.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <>
                <CommandSeparator />
                {searchResults.map((group) => (
                  <CommandGroup key={group.type} heading={group.type}>
                    {group.items.map((item) => (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          if (group.type === "Agents") {
                            runQuickAction(() => {});
                            return;
                          }
                          const link =
                            group.type === "Domains" ? "/" : item.link!;
                          runNav(link);
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
          </>
        )}

        {/* ─── Footer hint ──────────────────────────────────────────── */}
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
          <span className="hidden sm:inline">
            <kbd className="rounded border bg-muted px-1">&gt;</kbd> commands{" "}
            <kbd className="rounded border bg-muted px-1">#</kbd> tags{" "}
            <kbd className="rounded border bg-muted px-1">@</kbd> agents
          </span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}
