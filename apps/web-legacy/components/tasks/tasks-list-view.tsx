'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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

const statusOptions = ['todo', 'in_progress', 'done', 'cancelled'] as const;
const priorityOptions = ['low', 'medium', 'high', 'urgent'] as const;

const sortableColumns = [
  { key: 'title', label: 'Task' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due Date' },
] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          {label}
          {selected.length > 0 && (
            <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs font-medium">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => {
                    onChange(
                      checked
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt]
                    );
                  }}
                />
                <span className="capitalize">{opt.replace('_', ' ')}</span>
              </label>
            );
          })}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TasksListView({
  domainId,
  onRefresh,
}: {
  domainId: string;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastErrorRef = useRef<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const LIMIT = 50;
  const { subscribe } = useRealtimeContext();

  // Filter/sort state from URL params
  const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) || [];
  const priorityFilter = searchParams.get('priority')?.split(',').filter(Boolean) || [];
  const domainFilter = searchParams.get('domain') || '';
  const searchQuery = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'order';
  const order = searchParams.get('order') || 'asc';

  // Local search input (debounced)
  const [searchInput, setSearchInput] = useState(searchQuery);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      } else {
        params.delete('search');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearch, searchQuery, searchParams, pathname, router]);

  const updateURLParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  const fetchTasks = useCallback(async (appendOffset?: number) => {
    if (!domainId) return;
    if (appendOffset === undefined) setLoading(true);
    else setLoadingMore(true);
    try {
      const currentOffset = appendOffset ?? 0;
      const params = new URLSearchParams({ sort, order, limit: String(LIMIT), offset: String(currentOffset) });
      if (statusFilter.length > 0) params.set('status', statusFilter.join(','));
      if (priorityFilter.length > 0) params.set('priority', priorityFilter.join(','));
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/domains/${domainId}/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Unable to load tasks');
      const data = await response.json();
      if (appendOffset !== undefined) {
        setTasks(prev => [...prev, ...(data.items || [])]);
      } else {
        setTasks(data.items || []);
        setOffset(0);
      }
      setTotalCount(data.totalItems || 0);
      // Successful fetch — reset the dedup tracker so the next error
      // class toasts fresh instead of being suppressed.
      lastErrorRef.current = null;
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      // Only toast once per unique error message to prevent infinite spam
      // when realtime subscriptions re-trigger fetchTasks() on every event.
      const message = error instanceof Error ? error.message : 'Unable to load tasks';
      if (message !== lastErrorRef.current) {
        lastErrorRef.current = message;
        if (message.includes('429') || message.toLowerCase().includes('rate')) {
          toast.error('Rate limited — slowing down');
        } else {
          toast.error('Unable to load tasks');
        }
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [domainId, sort, order, statusFilter, priorityFilter, searchQuery]);

  function loadMore() {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchTasks(newOffset);
  }

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
    // Debounce realtime-triggered refetches so a burst of events does
    // not cause a flood of fetchTasks() calls + toasts.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        fetchTasks();
        onRefresh?.();
      }, 750);
    };
    debouncedRefetch.cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const unsubscribe = subscribe(['task'], (event: any) => {
      if (event.type === 'task') {
        debouncedRefetch();
      }
    });
    return () => {
      debouncedRefetch.cancel();
      unsubscribe;
    };
  }, [domainId, subscribe, fetchTasks, onRefresh]);

  // Clear selection when tasks change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tasks]);

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

  function toggleSort(column: string) {
    if (sort === column) {
      updateURLParam('order', order === 'asc' ? 'desc' : 'asc');
    } else {
      updateURLParam('sort', column);
      updateURLParam('order', 'asc');
    }
  }

  function getSortIcon(column: string) {
    if (sort !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return order === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  // Bulk actions
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStatus(newStatus: string) {
    if (selectedIds.size === 0) return;
    setBulkStatusOpen(false);
    try {
      const res = await fetch(`/api/domains/${domainId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          updates: { status: newStatus },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked ${selectedIds.size} tasks as ${newStatus.replace('_', ' ')}`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch {
      toast.error('Unable to update tasks');
    }
  }

  async function handleBulkPriority(newPriority: string) {
    if (selectedIds.size === 0) return;
    setBulkPriorityOpen(false);
    try {
      const res = await fetch(`/api/domains/${domainId}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          updates: { priority: newPriority },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Set priority for ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch {
      toast.error('Unable to update tasks');
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/tasks/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
      fetchTasks();
    } catch {
      toast.error('Unable to delete tasks');
    } finally {
      setBulkDeleting(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tasks...</p>;
  }

  return (
    <>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Status"
          options={statusOptions}
          selected={statusFilter}
          onChange={(values) =>
            updateURLParam('status', values.length > 0 ? values.join(',') : null)
          }
        />
        <MultiSelectFilter
          label="Priority"
          options={priorityOptions}
          selected={priorityFilter}
          onChange={(values) =>
            updateURLParam('priority', values.length > 0 ? values.join(',') : null)
          }
        />
        <Select
          value={domainFilter}
          onValueChange={(v) => updateURLParam('domain', v || null)}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="All domains" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value=" ">All domains</SelectItem>
            {Array.from(domainMap.entries()).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-8 pr-8"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 rounded-md border bg-background/95 p-2 backdrop-blur">
          <span className="text-sm font-medium text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="ml-2 flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkStatus('done')}
            >
              Mark done
            </Button>
            <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Set status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {statusOptions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleBulkStatus(s)}>
                    <span className="capitalize">{s.replace('_', ' ')}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu open={bulkPriorityOpen} onOpenChange={setBulkPriorityOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Set priority
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {priorityOptions.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => handleBulkPriority(p)}>
                    <span className="capitalize">{p}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No tasks yet. Create your first task to get started!</p>
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all tasks"
                    />
                  </TableHead>
                  {sortableColumns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        {getSortIcon(col.key)}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead>Domain</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                        aria-label={`Select "${task.title}"`}
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
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{domainMap.get(task.domainId) || task.domainId.slice(0, 8)}</Badge>
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

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
                try {
                  const res = await fetch(`/api/domains/${domainId}/tasks/${deleteId}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error();
                  toast.success('Task deleted');
                  setDeleteId(null);
                  fetchTasks();
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
