"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Flame } from "lucide-react";
import { toast } from "sonner";

interface Habit {
  id: string;
  name: string;
  description?: string;
  domain: string;
  frequency?: string;
  difficulty?: string;
  streak?: number;
}

export function HabitCard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  useEffect(() => { fetchHabits(); fetchDomains(); }, []);

  async function fetchHabits() {
    try {
      const res = await fetch("/api/habits?sort=-created");
      const data = await res.json();
      setHabits(data.items || []);
    } catch { toast.error("Unable to load habits"); }
    finally { setLoading(false); }
  }

  async function fetchDomains() {
    try {
      const res = await fetch("/api/domains?sort=sort_order");
      const data = await res.json();
      const map = new Map<string, string>();
      for (const d of data.items || []) map.set(d.id, d.name);
      setDomainMap(map);
    } catch {}
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/habits/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Habit deleted");
      setHabits((h) => h.filter((x) => x.id !== id));
    } catch { toast.error("Unable to delete habit"); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  if (loading) return <p className="text-muted-foreground">Loading habits...</p>;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {habits.map((habit) => (
          <Card key={habit.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{habit.name}</span>
                    {habit.streak && habit.streak > 0 && (
                      <span className="flex items-center gap-1 text-sm text-orange-500">
                        <Flame className="h-4 w-4" /> {habit.streak}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{domainMap.get(habit.domain) || habit.domain}</Badge>
                    {habit.frequency && <Badge variant="secondary" className="text-xs">{habit.frequency}</Badge>}
                    {habit.difficulty && <Badge variant="secondary" className="text-xs">{habit.difficulty}</Badge>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(habit)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(habit.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete habit?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
