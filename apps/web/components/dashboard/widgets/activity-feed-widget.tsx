'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, User, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export function ActivityFeedWidget() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    try {
      const res = await fetch('/api/agent-activity?perPage=20&sort=-created');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.items || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  function getActionIcon(action: string) {
    switch (action) {
      case 'created': return <Plus className="h-3 w-3 text-green-500" />;
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'deleted': return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-blue-500" />;
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Activity Feed
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-1.5">
            {activities.slice(0, 10).map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-md p-1.5 text-xs">
                <span className="mt-0.5 shrink-0">{getActionIcon(item.action)}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.actor}</span>{' '}
                  <span className="text-muted-foreground">{item.action}</span>{' '}
                  <Badge variant="outline" className="text-[10px]">{item.entity_type}</Badge>
                </div>
                <span className="shrink-0 text-muted-foreground">{timeAgo(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
