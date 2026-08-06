'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  domainId?: string;
  domain?: string;
}

interface Domain { id: string; name: string; color: string; }

export function TodayTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const router = useRouter();

  useEffect(() => {
    fetchTasks();
    fetchDomains();
  }, []);

  async function fetchDomains() {
    try {
      const res = await fetch("/api/domains?sort=sort_order");
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const d of data.items || []) map.set(d.id, d.name);
        setDomainMap(map);
      }
    } catch {}
  }

  async function fetchTasks() {
    try {
      const response = await fetch(
        '/api/tasks?status=todo,in_progress&perPage=5&sort=-priority'
      );
      if (response.ok) {
        const data = await response.json();
        setTasks(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" aria-hidden="true" />
            Today&apos;s Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => router.push('/tasks')}>
            View all
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks for today</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => toggleTask(task.id, task.status)}
                  aria-label={`Mark "${task.title}" as ${task.status === 'done' ? 'incomplete' : 'complete'}`}
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </Button>
                <span
                  className={`flex-1 text-sm ${
                    task.status === 'done'
                      ? 'line-through text-muted-foreground'
                      : ''
                  }`}
                >
                  {task.title}
                </span>
                <Badge variant="outline" className="text-xs">
                  {domainMap.get(task.domainId ?? task.domain ?? '') || task.domainId || task.domain}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
