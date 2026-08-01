'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Clock, CheckCircle2, PlusCircle, MessageSquare, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  workspaceId: string;
  createdAt: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  created: <PlusCircle className="h-3.5 w-3.5 text-green-500" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
  logged: <Flame className="h-3.5 w-3.5 text-orange-500" />,
  commented: <MessageSquare className="h-3.5 w-3.5 text-purple-500" />,
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function actionLabel(item: ActivityItem): string {
  const entity = item.entityType.charAt(0).toUpperCase() + item.entityType.slice(1);
  switch (item.action) {
    case 'created': return `${entity} created`;
    case 'completed': return `${entity} completed`;
    case 'logged': return `${entity} logged`;
    case 'commented': return `Comment on ${entity}`;
    default: return `${item.action} ${item.entityType}`;
  }
}

export function NotificationBell() {
  const [domainId, setDomainId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  // Auto-detect first domain
  useEffect(() => {
    fetch('/api/domains?sort=sort_order')
      .then((res) => res.json())
      .then((data) => {
        const items = data.items || [];
        if (items.length > 0) setDomainId(items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchActivities();
  }, [open, domainId]);

  async function fetchActivities() {
    if (!domainId) return;
    setLoading(true);
    fetchedRef.current = true;
    try {
      const res = await fetch(`/api/domains/${domainId}/activity?limit=10`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.items || []);
    } catch {
      // Silently fail — non-critical UI
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Activity</span>
          {activities.length > 0 && (
            <span className="text-xs text-muted-foreground">{activities.length} items</span>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-muted-foreground">No recent activity</span>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {actionIcons[item.action] || <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{actionLabel(item)}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeAgo(item.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
