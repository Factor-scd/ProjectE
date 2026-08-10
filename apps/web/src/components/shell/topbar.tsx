import { Search, Bell, Plus, Menu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/lib/stores/use-sidebar-store";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useApiQuery } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { DomainPicker } from "@/components/shell/domain-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import type { NotificationsResponse } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  completed: "completed",
};

function readableEntityType(entityType: string): string {
  return entityType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function Topbar() {
  const { setMobileOpen } = useSidebarStore();
  const queryClient = useQueryClient();
  const domainId = useApiDomain();

  const openPalette = () => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  const { data: notificationsData } = useApiQuery<NotificationsResponse>(
    ["notifications", domainId],
    "/notifications?workspace_id=" + encodeURIComponent(domainId),
    { enabled: !!domainId, refetchInterval: 60_000 }
  );

  const notifications = notificationsData?.items || [];
  const count = notificationsData?.count || 0;
  const badgeLabel = count > 99 ? "99+" : String(count);
  const tooltipText =
    count === 0
      ? "No notifications"
      : `${count} unread notification${count === 1 ? "" : "s"}`;

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-6"
      role="banner"
    >
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search input */}
      <div className="flex-1 md:max-w-sm">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={openPalette}
          aria-label="Open search (Cmd+K)"
        >
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          Search or jump to...{" "}
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* Domain picker */}
      <DomainPicker />

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Quick add */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={openPalette}
                aria-label="Quick add"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick add (Cmd+K)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Notifications bell */}
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    {count > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{tooltipText}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-medium">Notifications</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["notifications"] })}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />Refresh
                </Button>
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex cursor-default flex-col items-start gap-0.5 py-2">
                    <span className="text-sm capitalize">
                      {readableEntityType(n.entityType)}{" "}
                      {ACTION_LABELS[n.action] || n.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {n.actor} &middot; {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">User</span>
                <span className="text-xs text-muted-foreground">user@projecte.app</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {}}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              document.dispatchEvent(new CustomEvent("open-command-palette"));
            }}>
              Command palette
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
