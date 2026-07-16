'use client';

import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TasksKanbanView } from '@/components/tasks/tasks-kanban-view';
import { TasksListView } from '@/components/tasks/tasks-list-view';

export default function TasksPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

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

      {view === 'kanban' ? <TasksKanbanView /> : <TasksListView />}
    </div>
  );
}
