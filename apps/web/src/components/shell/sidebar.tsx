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
  BookOpen,
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
  { href: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "g d" },
  { href: "/tasks", label: "Tasks", icon: ListTodo, shortcut: "g t" },
  { href: "/habits", label: "Habits", icon: Flame, shortcut: "g h" },
  { href: "/projects", label: "Projects", icon: FolderKanban, shortcut: "g p" },
  { href: "/notes", label: "Notes", icon: NotebookPen, shortcut: "g n" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "g c" },
  { href: "/graph", label: "Graph", icon: Share2, shortcut: "g g" },
  { href: "/search", label: "Search", icon: Search },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/agents/activity", label: "Agent Activity", icon: Bot },
  { href: "/daily", label: "Daily Notes", icon: PenLine },
];

const bottomItems: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "g s" },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebarStore();
  const user = useAuthStore((s) => s.user);
  const userName = user?.name || user?.email?.split("@")[0] || "User";
  const userInitials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  // Sidebar position (left/right) is set in Settings. Read once on mount and
  // update live via the "sidebar-position-change" custom event dispatched by
  // the settings page.
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
    const link = (
      <Link
        key={item.href}
        to={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        activeProps={{ className: "bg-accent text-accent-foreground" }}
      >
        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!isCollapsed && (
          <>
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-0 group-hover/item:opacity-100 transition-opacity">
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
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side={sidebarPos === "right" ? "left" : "right"}>{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href} className="group/item">{link}</div>;
  };

  const navigation = (isCollapsed: boolean, onNavigate?: () => void) => (
    <ScrollArea className="flex-1 py-2">
      <nav className="flex flex-col gap-1 px-2" aria-label="Primary">
        {navItems.map((item) => renderNavLink(item, isCollapsed, onNavigate))}
      </nav>
      <Separator className="my-3" />
      <nav className="flex flex-col gap-1 px-2" aria-label="Workspace">
        {!isCollapsed && (
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
          "hidden flex-col bg-card transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
          sidebarPos === "right" ? "order-last border-l" : "border-r"
        )}
        aria-label="Main navigation"
      >
        {/* Logo + collapse */}
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                E
              </span>
              Project E
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
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
        <div className="border-t p-2">
          {collapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
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
                <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
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
        <SheetContent side={sidebarPos === "right" ? "right" : "left"} className="flex w-72 flex-col p-0 md:hidden">
          <SheetHeader className="border-b px-4 py-4 pr-12">
            <SheetTitle>Project E</SheetTitle>
            <SheetDescription>Navigate your workspace.</SheetDescription>
          </SheetHeader>
          <div className="border-b p-4">
            <DomainPicker />
          </div>
          {navigation(false, () => setMobileOpen(false))}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
