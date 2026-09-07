import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  ArrowRightLeft,
  AtSign,
  Bell,
  Bot,
  Check,
  Inbox,
  RefreshCw,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useApiQuery, useApiMutation, api } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { formatDistanceToNow } from "date-fns";
import type { Notification, NotificationCount, NotificationsResponse } from "@/lib/types";

const NOTIFICATION_META: Record<string, { icon: LucideIcon; color: string }> = {
  mention: { icon: AtSign, color: "text-blue-500" },
  status_change: { icon: ArrowRightLeft, color: "text-violet-500" },
  due_soon: { icon: AlarmClock, color: "text-amber-500" },
  automation: { icon: Bot, color: "text-emerald-500" },
  assignment: { icon: UserPlus, color: "text-cyan-500" },
};

/** Navigate to the entity a notification points at. Returns true when a route
 *  was matched (and the sheet should close). */
function navigateToEntity(navigate: ReturnType<typeof useNavigate>, n: Notification): boolean {
  if (!n.entityId || !n.entityType) return false;
  switch (n.entityType) {
    case "task":
      navigate({ to: "/tasks/$id", params: { id: n.entityId } });
      return true;
    case "note":
      navigate({ to: "/notes/$id", params: { id: n.entityId } });
      return true;
    case "project":
      navigate({ to: "/projects/$id", params: { id: n.entityId } });
      return true;
    case "habit":
      navigate({ to: "/habits/$id", params: { id: n.entityId } });
      return true;
    default:
      return false;
  }
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const domainId = useApiDomain();
  const [open, setOpen] = useState(false);

  // Own SSE connection so the badge stays live regardless of which page is
  // mounted; notification events invalidate the count + list queries.
  useRealtime({ enabled: true });

  const countQuery = useApiQuery<NotificationCount>(
    ["notifications-count", domainId],
    "/notifications/count" + (domainId ? `?workspace_id=${encodeURIComponent(domainId)}` : ""),
    { enabled: !!domainId, refetchInterval: 30_000 }
  );
  const unreadCount = countQuery.data?.count ?? 0;

  const listQuery = useApiQuery<NotificationsResponse>(
    ["notifications", domainId],
    "/notifications" + (domainId ? `?workspace_id=${encodeURIComponent(domainId)}&limit=50` : ""),
    { enabled: !!domainId && open }
  );
  const notifications = listQuery.data?.items ?? [];
  const loading = listQuery.isLoading || listQuery.isFetching;

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}`),
    onMutate: (id) => {
      // Optimistically decrement the badge so the UI feels instant.
      queryClient.setQueryData<NotificationCount>(["notifications-count", domainId], (old) =>
        old && old.count > 0 ? { count: old.count - 1 } : old
      );
      queryClient.setQueryData<NotificationsResponse>(["notifications", domainId], (old) =>
        old
          ? {
              ...old,
              items: old.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
              unreadCount: Math.max(0, old.unreadCount - 1),
            }
          : old
      );
      return id;
    },
    onSuccess: invalidateNotifications,
  });

  const markAllRead = useApiMutation<{ success: boolean; updated: number }, { workspace_id?: string }>(
    "post",
    "/notifications/read-all",
    {
      onMutate: () => {
        queryClient.setQueryData<NotificationCount>(["notifications-count", domainId], (old) =>
          old ? { count: 0 } : old
        );
        queryClient.setQueryData<NotificationsResponse>(["notifications", domainId], (old) =>
          old
            ? {
                ...old,
                items: old.items.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
                unreadCount: 0,
              }
            : old
        );
      },
      onSuccess: invalidateNotifications,
    }
  );

  const handleNotificationClick = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (navigateToEntity(navigate, n)) {
      setOpen(false);
    }
  };

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <SheetTrigger asChild>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
                  >
                    {badgeLabel}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
          </SheetTrigger>
          <TooltipContent>
            {unreadCount === 0 ? "No notifications" : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <SheetTitle className="text-base">Notifications</SheetTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate({ workspace_id: domainId || undefined })}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Refresh notifications"
              onClick={() => invalidateNotifications()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-full flex-1">
          {loading && notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              No notifications yet
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => {
                const meta = NOTIFICATION_META[n.type] ?? { icon: Bell, color: "text-muted-foreground" };
                const Icon = meta.icon;
                const unread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus:outline-none focus-visible:bg-accent/60 ${
                        unread ? "bg-accent/40" : ""
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${unread ? "font-semibold" : "font-medium text-muted-foreground"}`}>
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>
                        )}
                        <span className="mt-1 block text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                      {unread && (
                        <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
