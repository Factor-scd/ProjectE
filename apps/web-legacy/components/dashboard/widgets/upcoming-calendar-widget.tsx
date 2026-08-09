'use client';

import { useEffect, useState } from 'react';
import { Calendar, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface UpcomingItem {
  id: string;
  title: string;
  due_date: string;
  priority?: string;
  status?: string;
  name?: string;
  target_date?: string;
  color?: string;
}

export function UpcomingCalendarWidget() {
  const [tasks, setTasks] = useState<UpcomingItem[]>([]);
  const [projects, setProjects] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUpcoming();
  }, []);

  async function fetchUpcoming() {
    try {
      const res = await fetch('/api/tasks?perPage=10&sort=due_date');
      if (res.ok) {
        const data = await res.json();
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcoming = (data.items || []).filter((t: any) => {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          return d >= now && d <= nextWeek;
        });
        setTasks(upcoming);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Upcoming
          </CardTitle>
          <Badge variant="secondary" className="text-xs">{tasks.length} due</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming due dates</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 7).map((task) => (
              <div
                key={task.id}
                className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-accent/50"
                onClick={() => router.push('/tasks')}
              >
                <ListTodo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(task.due_date!)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
