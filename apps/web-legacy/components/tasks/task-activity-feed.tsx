'use client';

import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown> | null;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  completed: 'completed',
  uncompleted: 'reverted',
  bulk_updated: 'bulk updated',
  dependency_added: 'added dependency to',
  dependency_removed: 'removed dependency from',
  tag_added: 'added tag to',
  tag_removed: 'removed tag from',
};

export function TaskActivityFeed({ domainId }: { domainId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domainId) return;
    fetch(`/api/domains/${domainId}/activity?entity_type=task&limit=10`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load activity');
        return res.json();
      })
      .then((data) => {
        setActivities(data.items || []);
      })
      .catch((err) => {
        console.error('Failed to load activity feed:', err);
      })
      .finally(() => setLoading(false));
  }, [domainId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {activities.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 text-sm">
            <Badge variant="outline" className="mt-0.5 shrink-0 text-xs capitalize">
              {actionLabels[entry.action] || entry.action}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-muted-foreground">
                <span className="font-medium text-foreground">{entry.actor}</span>
                {' '}
                {actionLabels[entry.action] || entry.action}
                {' '}
                {entry.changes && typeof entry.changes === 'object' && 'title' in entry.changes
                  ? `"${entry.changes.title}"`
                  : entry.entityId.slice(0, 8)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
