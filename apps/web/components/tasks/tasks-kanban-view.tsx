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
import { Calendar, GripVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailPanel } from './task-detail-panel';
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
  onClick,
}: {
  task: Task;
  domainName: string;
  domainColor: string | null;
  onClick: () => void;
}) {
  const subtaskCount = 0; // Will be populated from API

  return (
    <Card className="mb-2 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-medium leading-tight">
            {task.title}
          </span>
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
              title={}
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
  onTaskClick,
  onAddTask,
}: {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  domainMap: Map<string, { name: string; color: string | null }>;
  onTaskClick: (task: Task) => void;
  onAddTask: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-sm text-muted-foreground">({tasks.length})</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onAddTask}
          aria-label={`Add task to ${title}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
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
              onClick={() => onTaskClick(task)}
            />
          ))
        )}
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

  function handleAddTask(status: string) {
    // Open create dialog with pre-filled status
    document.dispatchEvent(
      new CustomEvent('open-create-task', { detail: { status, domainId } })
    );
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
            onTaskClick={setSelectedTask}
            onAddTask={() => handleAddTask(column.id)}
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
