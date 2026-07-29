'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, GripVertical, Link2, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailPanel } from './task-detail-panel';
import { useRealtimeContext } from '@/components/realtime-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  domainId: string;
  dueDate?: string | null;
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  order: number;
  tags: { id: string; name: string; color: string | null }[];
  completedAt?: string | null;
  estimatedMinutes?: number | null;
}

interface Domain {
  id: string;
  name: string;
  color: string | null;
}

const columns = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'done', title: 'Done', color: 'bg-green-500' },
  { id: 'cancelled', title: 'Cancelled', color: 'bg-red-500' },
];

const priorityColors: Record<string, string> = {
  urgent: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'secondary',
};

function TaskCard({
  task,
  domainName,
  domainColor,
  depCount,
  onClick,
}: {
  task: Task;
  domainName: string;
  domainColor: string | null;
  depCount: number;
  onClick: () => void;
}) {
  return (
    <Card className="mb-2 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-medium leading-tight">
            {task.title}
          </span>
          {depCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center text-xs text-muted-foreground shrink-0">
                    <Link2 className="h-3 w-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{depCount} {depCount === 1 ? 'dependency' : 'dependencies'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={priorityColors[task.priority] as any || 'secondary'}
            className="text-xs"
          >
            {task.priority}
          </Badge>
          {domainColor && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: domainColor }}
              aria-hidden="true"
            />
          )}
          {domainName && (
            <span className="text-xs text-muted-foreground">{domainName}</span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
          {task.estimatedMinutes && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title={`Estimated: ${task.estimatedMinutes}m`}
            >
              <Clock className="h-3 w-3" />
              {task.estimatedMinutes}m
            </span>
          )}
          {task.tags?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {task.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs"
                  style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                >
                  {tag.name}
                </Badge>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  id,
  title,
  color,
  tasks,
  domainMap,
  depCounts,
  onTaskClick,
  inlineInput,
  onInlineInputChange,
  onInlineSubmit,
  inlineLoading,
}: {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  domainMap: Map<string, { name: string; color: string | null }>;
  depCounts: Map<string, number>;
  onTaskClick: (task: Task) => void;
  inlineInput: string;
  onInlineInputChange: (value: string) => void;
  onInlineSubmit: () => void;
  inlineLoading: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-sm text-muted-foreground">({tasks.length})</span>
        </div>
      </div>
      <div
        role="list"
        aria-label={`${title} tasks (${tasks.length} items)`}
        className="flex-1 rounded-lg border-2 border-dashed p-2 min-h-[200px] transition-colors border-muted"
      >
        {tasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              domainName={domainMap.get(task.domainId)?.name || ''}
              domainColor={domainMap.get(task.domainId)?.color || null}
              depCount={depCounts.get(task.id) || 0}
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
      </div>
      {/* Inline task creation input */}
      <div className="mt-2 flex items-center gap-2">
        <Input
          placeholder="New task title..."
          value={inlineInput}
          onChange={(e) => onInlineInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !inlineLoading) {
              onInlineSubmit();
            }
          }}
          className="h-8 text-sm"
          disabled={inlineLoading}
        />
        <Button
          size="sm"
          className="h-8 shrink-0"
          onClick={onInlineSubmit}
          disabled={!inlineInput.trim() || inlineLoading}
        >
          {inlineLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
        </Button>
      </div>
    </div>
  );
}

export function TasksKanbanView({
  domainId,
  onRefresh,
}: {
  domainId: string;
  onRefresh?: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [domainMap, setDomainMap] = useState<Map<string, { name: string; color: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});
  const [inlineLoading, setInlineLoading] = useState<Record<string, boolean>>({});
  const [depCounts, setDepCounts] = useState<Map<string, number>>(new Map());
  const { subscribe } = useRealtimeContext();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchTasks = useCallback(async () => {
    if (!domainId) return;
    try {
      const response = await fetch(`/api/domains/${domainId}/tasks?sort=order&limit=200`);
      if (!response.ok) throw new Error('Unable to load tasks');
      const data = await response.json();
      setTasks(data.items || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Unable to load tasks');
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  const fetchDomains = useCallback(async () => {
    try {
      const response = await fetch('/api/domains?sort=sort_order');
      if (!response.ok) return;
      const data = await response.json();
      const map = new Map<string, { name: string; color: string | null }>();
      for (const d of data.items || []) {
        map.set(d.id, { name: d.name, color: d.color || null });
      }
      setDomainMap(map);
    } catch {
      // Non-critical
    }
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

  // Fetch dependency counts for visible tasks
  useEffect(() => {
    if (tasks.length === 0 || !domainId) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      const counts = new Map<string, number>();
      // Fetch task details in parallel to get dependency counts
      const results = await Promise.allSettled(
        tasks.map((t) =>
          fetch(`/api/domains/${domainId}/tasks/${t.id}`, { signal: controller.signal })
            .then((r) => (r.ok ? r.json() : null))
        )
      );
      if (cancelled) return;
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled' && r.value?.dependencies?.length > 0) {
          counts.set(tasks[i].id, r.value.dependencies.length);
        }
      }
      setDepCounts(counts);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tasks, domainId]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as Task['status'];
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(`/api/domains/${domainId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Unable to move task');
      toast.success(
        `Moved "${task.title}" to ${columns.find((c) => c.id === newStatus)?.title}`
      );
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast.error(`Unable to move "${task.title}"`);
      fetchTasks(); // Revert
    }
  }

  async function handleInlineCreate(status: string) {
    const title = inlineInputs[status]?.trim();
    if (!title) return;

    setInlineLoading((prev) => ({ ...prev, [status]: true }));

    try {
      const response = await fetch(`/api/domains/${domainId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status }),
      });
      if (!response.ok) throw new Error('Unable to create task');
      const newTask = await response.json();
      // Prepend the new task to the list
      setTasks((prev) => [{ ...newTask, tags: [] }, ...prev]);
      setInlineInputs((prev) => ({ ...prev, [status]: '' }));
      toast.success(`Created "${title}"`);
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Unable to create task');
    } finally {
      setInlineLoading((prev) => ({ ...prev, [status]: false }));
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {columns.map((column) => (
          <DroppableColumn
            key={column.id}
            id={column.id}
            title={column.title}
            color={column.color}
            tasks={tasks.filter((t) => t.status === column.id)}
            domainMap={domainMap}
            depCounts={depCounts}
            onTaskClick={setSelectedTask}
            inlineInput={inlineInputs[column.id] || ''}
            onInlineInputChange={(value) =>
              setInlineInputs((prev) => ({ ...prev, [column.id]: value }))
            }
            onInlineSubmit={() => handleInlineCreate(column.id)}
            inlineLoading={inlineLoading[column.id] || false}
          />
        ))}
      </div>

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
