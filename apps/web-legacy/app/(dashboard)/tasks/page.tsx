"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksKanbanView } from "@/components/tasks/tasks-kanban-view";
import { TasksListView } from "@/components/tasks/tasks-list-view";
import { CreateItemDialog } from "@/components/create-item-dialog";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";
import { RealtimeProvider } from "@/components/realtime-provider";

export default function TasksPage() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [refreshKey, setRefreshKey] = useState(0);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const { open, openCreate, closeCreate } = useCreateDialogStore();

  // Fetch domains and select first one
  useEffect(() => {
    fetch('/api/domains?sort=sort_order')
      .then((res) => res.json())
      .then((data) => {
        const items = data.items || [];
        setDomains(items);
        if (items.length > 0 && !domainId) {
          setDomainId(items[0].id);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RealtimeProvider>
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="mt-1 text-muted-foreground">Move work forward without losing the thread.</p>
        </div>
        <div className="flex items-center gap-2">
          {domains.length > 1 && (
            <select
              value={domainId || ''}
              onChange={(e) => setDomainId(e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              aria-label="Select domain"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          <Button onClick={() => openCreate("task")}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New task
          </Button>
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="h-4 w-4" aria-hidden="true" /> Board</TabsTrigger>
              <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" aria-hidden="true" /> List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      {domainId && (view === "kanban" ? <TasksKanbanView key={refreshKey} domainId={domainId} /> : <TasksListView key={refreshKey} domainId={domainId} />)}
      <CreateItemDialog type="task" open={open} onOpenChange={(o) => (o ? openCreate("task") : closeCreate())} onCreated={() => setRefreshKey((k) => k + 1)} />
    </div>
    </RealtimeProvider>
  );
}
