'use client';

import { useEffect, useState } from 'react';
import {
  KeyboardSensor,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Calendar, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { TaskDetailPanel } from './task-detail-panel';

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

const columns = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'done', title: 'Done', color: 'bg-green-500' }
];

function DraggableTask({
  task,
  onClick,
  onStatusChange
}: {
  task: Task;
  onClick: () => void;
  onStatusChange: (task: Task, status: Task['status']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task }
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-50' : ''}
    >
      <Card className="mb-2 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="flex-1 text-left text-sm font-medium hover:underline"
            >
              {task.title}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 cursor-grab active:cursor-grabbing"
              aria-label={`Drag ${task.title}`}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Select
            value={task.status}
            onValueChange={(status) =>
              onStatusChange(task, status as Task['status'])
            }
          >
            <SelectTrigger
              className="mb-2 h-9"
              aria-label={`Move ${task.title} to a status`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={
                task.priority === 'urgent'
                  ? 'destructive'
                  : task.priority === 'high'
                    ? 'default'
                    : 'secondary'
              }
              className="text-xs"
            >
              {task.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {task.domain}
            </Badge>
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  color,
  tasks,
  onTaskClick,
  onStatusChange
}: {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (task: Task, status: Task['status']) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">({tasks.length})</span>
      </div>
      <div
        ref={setNodeRef}
        role="list"
        aria-label={`${title} tasks (${tasks.length} items)`}
        className={`flex-1 rounded-lg border-2 border-dashed p-3 min-h-[400px] transition-colors ${
          isOver ? 'border-primary bg-primary/5' : 'border-muted'
        }`}
      >
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

export function TasksKanbanView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    fetchTasks();
  }, []);

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      setActiveTask(null);
      return;
    }

    const task = active.data.current?.task as Task;
    const newStatus = over.id as Task['status'];

    if (task.status !== newStatus) {
      await updateTaskStatus(task, newStatus);
    }
    setActiveTask(null);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task;
    setActiveTask(task);
  }

  async function updateTaskStatus(task: Task, status: Task['status']) {
    if (task.status === status) return;

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Unable to move task');

      await fetchTasks();
      toast.success(
        `Moved ${task.title} to ${columns.find((column) => column.id === status)?.title}`
      );
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast.error(`Unable to move ${task.title}`);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              tasks={tasks.filter((t) => t.status === column.id)}
              onTaskClick={setSelectedTask}
              onStatusChange={updateTaskStatus}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <Card className="rotate-3 shadow-xl">
              <CardContent className="p-4">
                <p className="text-sm font-medium">{activeTask.title}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

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
