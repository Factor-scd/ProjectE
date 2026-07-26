'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  domain: string;
  due_date?: string;
  project_id?: string;
  tags: string[];
}

export function TasksListView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchTasks();
    fetchDomains();
  }, []);

  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
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
      const response = await fetch('/api/tasks?sort=-created');
      if (!response.ok) {
        throw new Error('Unable to load tasks');
      }
      const data = await response.json();
      setTasks(data.items || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskComplete(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Unable to update task');
      await fetchTasks();
      toast.success(
        `Marked ${task.title} as ${newStatus === 'done' ? 'complete' : 'incomplete'}`
      );
    } catch (error) {
      console.error('Failed to toggle task:', error);
      toast.error(`Unable to update ${task.title}`);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
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
                    <Badge
                      variant={
                        task.priority === 'urgent'
                          ? 'destructive'
                          : task.priority === 'high'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{domainMap.get(task.domain) || task.domain}</Badge>
                  </TableCell>
                  <TableCell>
                    {task.due_date && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString()}
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
            <AlertDialogAction onClick={async () => {
              if (!deleteId) return;
              setDeleting(true);
              try {
                const res = await fetch("/api/tasks/" + deleteId, { method: 'DELETE' });
                if (!res.ok) throw new Error();
                toast.success("Task deleted");
                setDeleteId(null);
                fetchTasks();
              } catch { toast.error("Unable to delete task"); }
              finally { setDeleting(false); setDeleteId(null); }
            }} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onUpdate={fetchTasks}
        />
      )}
    </>
  );
}
