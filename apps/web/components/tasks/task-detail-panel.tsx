'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { Calendar, Loader2 } from 'lucide-react';

interface TaskDetail {
  id: string;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  domainId: string;
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  estimatedMinutes?: number | null;
  trackedMinutes?: number | null;
  order: number;
  customFields?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  subtasks: any[];
  tags: { id: string; name: string; color: string | null }[];
  dependencies: { id: string; title: string; status: string }[];
  dependents: { id: string; title: string; status: string }[];
}

interface TaskDetailPanelProps {
  taskId: string;
  domainId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TaskDetailPanel({
  taskId,
  domainId,
  open,
  onOpenChange,
  onUpdate,
}: TaskDetailPanelProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'done' | 'cancelled'>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch task details when panel opens
  useEffect(() => {
    if (!open || !taskId || !domainId) return;
    setLoading(true);
    fetch(`/api/domains/${domainId}/tasks/${taskId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load task');
        return res.json();
      })
      .then((data: TaskDetail) => {
        setTask(data);
        setTitle(data.title);
        setDescription(data.description || '');
        setStatus(data.status);
        setPriority(data.priority);
        setDueDate(data.dueDate ? data.dueDate.split('T')[0] : '');
        setEstimatedMinutes(data.estimatedMinutes?.toString() || '');
      })
      .catch((err) => {
        console.error('Failed to load task:', err);
        toast.error('Unable to load task details');
      })
      .finally(() => setLoading(false));
  }, [open, taskId, domainId]);

  async function handleSave() {
    if (!task || !domainId) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        status,
        priority,
      };
      if (description !== (task.description || '')) body.description = description || null;
      if (dueDate !== (task.dueDate ? task.dueDate.split('T')[0] : '')) {
        body.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
      }
      if (estimatedMinutes !== (task.estimatedMinutes?.toString() || '')) {
        body.estimatedMinutes = estimatedMinutes ? parseInt(estimatedMinutes, 10) : null;
      }

      const response = await fetch(`/api/domains/${domainId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Unable to save task');
      onUpdate();
      onOpenChange(false);
      toast.success('Task saved');
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error('Unable to save task');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task || !domainId) return;
    setDeleting(true);
    const deletedTask = { ...task };
    try {
      const response = await fetch(`/api/domains/${domainId}/tasks/${task.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Unable to delete task');
      onUpdate();
      setDeleteOpen(false);
      onOpenChange(false);
      toast.success('Task deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
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
                  estimatedMinutes: deletedTask.estimatedMinutes,
                  projectId: deletedTask.projectId,
                  sectionId: deletedTask.sectionId,
                  parentId: deletedTask.parentId,
                }),
              });
              onUpdate();
              toast.success('Task restored');
            } catch {
              toast.error('Unable to restore task');
            }
          },
        },
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Unable to delete task');
    } finally {
      setDeleting(false);
    }
  }

  // Timer tick effect
  useEffect(() => {
    if (!timerRunning || !timerStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - timerStartedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerStartedAt]);

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return \`\${h}h \${m}m\`;
    if (m > 0) return \`\${m}m \${s}s\`;
    return \`\${s}s\`;
  }

  async function handleStartTimer() {
    setTimerRunning(true);
    setTimerStartedAt(new Date());
  }

  async function handleStopTimer() {
    if (!timerStartedAt || !task) return;
    const deltaMinutes = Math.round((Date.now() - timerStartedAt.getTime()) / 60000);
    if (deltaMinutes < 1) {
      setTimerRunning(false);
      setTimerStartedAt(null);
      return;
    }
    const newTracked = (task.trackedMinutes || 0) + deltaMinutes;
    try {
      const response = await fetch(\`/api/domains/\${domainId}/tasks/\${task.id}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackedMinutes: newTracked }),
      });
      if (!response.ok) throw new Error("Unable to save tracked time");
      setTask({ ...task, trackedMinutes: newTracked });
      onUpdate();
      toast.success(\`Tracked \${deltaMinutes} minute\${deltaMinutes !== 1 ? "s" : ""}\`);
    } catch {
      toast.error("Unable to save tracked time");
    } finally {
      setTimerRunning(false);
      setTimerStartedAt(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Task Details</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !task ? (
          <div className="mt-12 text-center text-muted-foreground">
            <p>Task not found</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as any)}
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as any)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-estimate">Est. Minutes</Label>
                <Input
                  id="task-estimate"
                  type="number"
                  min={1}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            {/* Time Tracking */}
            <div className="space-y-3">
              <Label>Time Tracking</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tracked: {task.trackedMinutes || 0}m / {task.estimatedMinutes || 0}m
                  </span>
                  {task.estimatedMinutes && task.estimatedMinutes > 0 && (
                    <span className="text-muted-foreground">
                      {Math.min(100, Math.round(((task.trackedMinutes || 0) / task.estimatedMinutes) * 100))}%
                    </span>
                  )}
                </div>
                {task.estimatedMinutes && task.estimatedMinutes > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: \`\${Math.min(100, Math.round(((task.trackedMinutes || 0) / task.estimatedMinutes) * 100))}%\`,
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {timerRunning ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleStopTimer}
                        className="gap-1"
                      >
                        <Square className="h-4 w-4" />
                        Stop timer
                      </Button>
                      <span className="text-sm font-mono text-primary">
                        {formatDuration(elapsedSeconds)}
                      </span>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartTimer}
                      className="gap-1"
                    >
                      <Play className="h-4 w-4" />
                      Start timer
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2 flex-wrap">
                  {task.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {task.dependencies && task.dependencies.length > 0 && (
              <div className="space-y-2">
                <Label>Depends on</Label>
                <div className="space-y-1">
                  {task.dependencies.map((dep) => (
                    <div key={dep.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">•</span>
                      <span>{dep.title}</span>
                      <Badge variant="outline" className="text-xs capitalize">{dep.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="space-y-2">
                <Label>Subtasks ({task.subtasks.length})</Label>
                <div className="space-y-1">
                  {task.subtasks.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">•</span>
                      <span className={sub.status === 'done' ? 'line-through text-muted-foreground' : ''}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
              <p>Updated: {new Date(task.updatedAt).toLocaleString()}</p>
              {task.completedAt && (
                <p>Completed: {new Date(task.completedAt).toLocaleString()}</p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="ml-auto"
              >
                Delete
              </Button>
            </div>
          </div>
        )}

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete task?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes &quot;{task?.title}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
