import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/lib/stores/use-sidebar-store";
import { useAuthStore } from "@/lib/stores/use-auth-store";
import {
  LayoutDashboard,
  ListTodo,
  Flame,
  FolderKanban,
  NotebookPen,
  Share2,
  CalendarDays,
  Search,
  BarChart3,
  Bot,
  PenLine,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Inbox,
  FileBarChart,
  FileStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DomainPicker } from "@/components/shell/domain-picker";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const navItems: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "g i" },
  { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "g d" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, shortcut: "g t" },
  { href: "/habits", label: "Habits", icon: Flame, shortcut: "g h" },
  { href: "/projects", label: "Projects", icon: FolderKanban, shortcut: "g p" },
  { href: "/notes", label: "Notes", icon: NotebookPen, shortcut: "g n" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "g c" },
  { href: "/graph", label: "Graph", icon: Share2, shortcut: "g g" },
  { href: "/search", label: "Search", icon: Search },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileBarChart, shortcut: "g r" },
  { href: "/agents/activity", label: "Agent Activity", icon: Bot },
  { href: "/daily", label: "Daily Notes", icon: PenLine },
  { href: "/templates", label: "Templates", icon: FileStack },
];

const bottomItems: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "g s" },
];

/** Map nav href to an ENTITY key for icon coloring. */
function entityKey(href: string): string {
  if (href === "/") return "dashboard";
  const segment = href.split("/")[1];
  return segment || "dashboard";
}

const ICON_COLORS: Record<string, string> = {
  dashboard: "hsl(var(--foreground))",
  inbox: "#f97316",
  tasks: "#3b82f6",
  habits: "#10b981",
  projects: "#8b5cf6",
  notes: "#f59e0b",
  calendar: "hsl(var(--foreground))",
  graph: "hsl(var(--foreground))",
  search: "hsl(var(--foreground))",
  analytics: "hsl(var(--foreground))",
  reports: "#6366f1",
  agents: "hsl(var(--foreground))",
  daily: "hsl(var(--foreground))",
  templates: "#6366f1",
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarStore();
  const user = useAuthStore((s) => s.user);
  const userName = user?.name || user?.email?.split("@")[0] || "User";
  const userInitials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  const [sidebarPos, setSidebarPos] = useState<"left" | "right">(() =>
    typeof window !== "undefined" && localStorage.getItem("sidebar-position") === "right"
      ? "right"
      : "left"
  );

  useEffect(() => {
    const onSidebarPositionChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "left" || detail === "right") setSidebarPos(detail);
    };
    window.addEventListener("sidebar-position-change", onSidebarPositionChange);
    return () => window.removeEventListener("sidebar-position-change", onSidebarPositionChange);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const renderNavLink = (item: NavItem, isCollapsed: boolean, onNavigate?: () => void) => {
    const active = isActive(item.href);
    const key = entityKey(item.href);
    const iconColor = ICON_COLORS[key] ?? "hsl(var(--foreground))";

    const link = (
      <Link
        key={item.href}
        to={item.href}
        onClick={onNavigate}
        className={cn(
          "group/item flex items-center gap-3 rounded-md py-2 pl-3 pr-2 text-sm font-medium transition-colors",
          active
            ? "border-l-[3px] border-l-[hsl(var(--accent-hsl))] bg-accent/50 text-accent-foreground"
            : "border-l-[3px] border-l-transparent hover:bg-accent/30 text-muted-foreground hover:text-accent-foreground",
          isCollapsed && "!justify-center pl-0 pr-0 border-l-0"
        )}
        activeProps={{ className: "border-l-[3px] border-l-[hsl(var(--accent-hsl))] bg-accent/50 text-accent-foreground" }}
      >
        <span style={active ? { color: iconColor } : undefined} className="inline-flex shrink-0">
          <item.icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {!isCollapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && (
              <kbd className="pointer-events-none inline-flex h-5 shrink-0 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground transition-opacity">
                {item.shortcut}
              </kbd>
            )}
          </>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <div className="flex justify-center">{link}</div>
          </TooltipTrigger>
          <TooltipContent side={sidebarPos === "right" ? "left" : "right"}>{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  const navigation = (isCollapsed: boolean, onNavigate?: () => void) => (
    <ScrollArea className="flex-1 py-2">
      <nav className="flex flex-col gap-0.5 px-2" aria-label="Primary">
        {navItems.map((item) => renderNavLink(item, isCollapsed, onNavigate))}
      </nav>
      <Separator className="my-2" />
      <nav className="flex flex-col gap-0.5 px-2" aria-label="Workspace">
        {!isCollapsed && (
          <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
        )}
        {bottomItems.map((item) => renderNavLink(item, isCollapsed, onNavigate))}
      </nav>
    </ScrollArea>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden flex-col bg-sidebar transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
          sidebarPos === "right"
            ? "order-last border-l border-sidebar-border"
            : "border-r border-sidebar-border"
        )}
        aria-label="Main navigation"
      >
        {/* Logo + collapse */}
        <div className="flex h-12 items-center justify-between px-3">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                E
              </span>
              <span className="text-sm">Project E</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>

        <Separator />

        {navigation(collapsed)}

        {/* User avatar + logout at bottom */}
        <div className="border-t border-sidebar-border p-2">
          {collapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={sidebarPos === "right" ? "left" : "right"} align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" }).then(() => {
                    window.location.href = "/login";
                  });
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2.5 px-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={sidebarPos === "right" ? "left" : "right"} align="start" className="w-48">
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" }).then(() => {
                    window.location.href = "/login";
                  });
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side={sidebarPos === "right" ? "right" : "left"} className="flex w-72 flex-col p-0 bg-sidebar md:hidden">
          <SheetHeader className="border-b border-sidebar-border px-4 py-3 pr-12">
            <SheetTitle>Project E</SheetTitle>
            <SheetDescription>Navigate your workspace.</SheetDescription>
          </SheetHeader>
          <div className="border-b border-sidebar-border p-3">
            <DomainPicker />
          </div>
          {navigation(false, () => setMobileOpen(false))}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
