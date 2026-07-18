'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TasksKanbanView } from '@/components/tasks/tasks-kanban-view';
import { TasksListView } from '@/components/tasks/tasks-list-view';
import { CreateItemDialog } from '@/components/create-item-dialog';

export default function TasksPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === 'true') setCreateOpen(true);
  }, []);

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    if (!open && new URLSearchParams(window.location.search).get('new') === 'true') {
      window.history.replaceState(null, '', '/tasks');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="mt-1 text-muted-foreground">
            Move work forward without losing the thread.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New task
          </Button>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as 'kanban' | 'list')}
          >
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" aria-hidden="true" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === 'kanban' ? (
        <TasksKanbanView key={refreshKey} />
      ) : (
        <TasksListView key={refreshKey} />
      )}
      <CreateItemDialog
        type="task"
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        onCreated={() => setRefreshKey((key) => key + 1)}
      />
    </div>
  );
}
