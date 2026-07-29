'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Calendar, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailPanel } from './task-detail-panel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRealtimeContext } from '@/components/realtime-provider';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  domainId: string;
  dueDate?: string | null;
  projectId?: string | null;
  order: number;
  tags: { id: string; name: string; color: string | null }[];
}

const priorityColors: Record<string, string> = {
  urgent: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'secondary',
};

export function TasksListView({
  domainId,
  onRefresh,
}: {
  domainId: string;
  onRefresh?: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const LIMIT = 50;
  const { subscribe } = useRealtimeContext();

  const fetchTasks = useCallback(async (appendOffset) => {
    if (!domainId) return;
    if (appendOffset === undefined) setLoading(true);
    else setLoadingMore(true);
    try {
      const currentOffset = appendOffset ?? 0;
      const response = await fetch(`/api/domains/${domainId}/tasks?sort=order&limit=${LIMIT}&offset=${currentOffset}`);
      if (!response.ok) throw new Error('Unable to load tasks');
      const data = await response.json();
      if (appendOffset !== undefined) {
        setTasks(prev => [...prev, ...(data.items || [])]);
      } else {
        setTasks(data.items || []);
        setOffset(0);
      }
      setTotalCount(data.totalItems || 0);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Unable to load tasks');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [domainId]);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const d of data.items || []) map.set(d.id, d.name);
        setDomainMap(map);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!domainId) return;
    setLoading(true);
    fetchTasks();
    fetchDomains();
  }, [domainId, fetchTasks, fetchDomains]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!domainId) return;
    const unsubscribe = subscribe(['task'], (event: any) => {
      if (event.type === 'task') {
        fetchTasks();
        onRefresh?.();
      }
    });
    return unsubscribe;
  }, [domainId, subscribe, fetchTasks, onRefresh]);

  function loadMore() {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchTasks(newOffset);
  }

  async function toggleTaskComplete(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const response = await fetch(`/api/domains/${domainId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Unable to update task');
      await fetchTasks();
      toast.success(
        `Marked "${task.title}" as ${newStatus === 'done' ? 'complete' : 'incomplete'}`
      );
    } catch (error) {
      console.error('Failed to toggle task:', error);
      toast.error(`Unable to update "${task.title}"`);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  if (tasks.length === 0 && !loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No tasks yet. Create your first task to get started!</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="min-w-[700px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Checkbox
                      checked={task.status === 'done'}
                      onCheckedChange={() => toggleTaskComplete(task)}
                      aria-label={`Mark "${task.title}" as ${task.status === 'done' ? 'incomplete' : 'complete'}`}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setSelectedTask(task)}
                      className={`text-left font-medium hover:underline ${
                        task.status === 'done'
                          ? 'line-through text-muted-foreground'
                          : ''
                      }`}
                    >
                      {task.title}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={(priorityColors[task.priority] as any) || 'secondary'}
                    >
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{domainMap.get(task.domainId) || task.domainId.slice(0, 8)}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.dueDate && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          aria-label={`More options for ${task.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(task.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
            <span>Showing {tasks.length} of {totalCount} tasks</span>
            {tasks.length < totalCount && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            )}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId || !domainId) return;
                setDeleting(true);
                const deletedTask = tasks.find(t => t.id === deleteId);
                try {
                  const res = await fetch(`/api/domains/${domainId}/tasks/${deleteId}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error();
                  setDeleteId(null);
                  fetchTasks();
                  toast.success('Task deleted', {
                    action: {
                      label: 'Undo',
                      onClick: async () => {
                        if (!deletedTask) return;
                        try {
                          await fetch(`/api/domains/${domainId}/tasks`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: deletedTask.title,
                              description: deletedTask.description,
                              status: deletedTask.status,
                              priority: deletedTask.priority,
                              dueDate: deletedTask.dueDate,
                              projectId: deletedTask.projectId,
                            }),
                          });
                          fetchTasks();
                          toast.success('Task restored');
                        } catch {
                          toast.error('Unable to restore task');
                        }
                      },
                    },
                  });
                } catch {
                  toast.error('Unable to delete task');
                } finally {
                  setDeleting(false);
                  setDeleteId(null);
                }
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTask && (
        <TaskDetailPanel
          taskId={selectedTask.id}
          domainId={domainId}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onUpdate={fetchTasks}
        />
      )}
    </>
  );
}
