"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HabitCard } from "@/components/habits/habit-card";
import { CreateItemDialog } from "@/components/create-item-dialog";
import { useCreateDialogStore } from "@/lib/stores/use-create-dialog-store";

export default function HabitsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { open, openCreate, closeCreate } = useCreateDialogStore();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="mt-1 text-muted-foreground">Build consistency, one day at a time.</p>
        </div>
        <Button onClick={() => openCreate("habit")}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> New habit
        </Button>
      </div>
      <HabitCard key={refreshKey} />
      <CreateItemDialog type="habit" open={open} onOpenChange={(o) => (o ? openCreate("habit") : closeCreate())} onCreated={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
