"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Domain {
  id: string;
  name: string;
  color: string;
}

export function HabitCard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editFrequency, setEditFrequency] = useState("daily");
  const [editDifficulty, setEditDifficulty] = useState("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchHabits(); fetchDomains(); }, []);

  useEffect(() => {
    if (editing) {
      setEditName(editing.name);
      setEditDescription(editing.description || "");
      setEditDomain(editing.domain);
      setEditFrequency(editing.frequency || "daily");
      setEditDifficulty(editing.difficulty || "medium");
    }
  }, [editing]);

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
      const items = data.items || [];
      const map = new Map<string, string>();
      for (const d of items) map.set(d.id, d.name);
      setDomainMap(map);
      setDomains(items);
    } catch {}
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch("/api/habits/" + id, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Habit deleted");
      setHabits((h) => h.filter((x) => x.id !== id));
    } catch { toast.error("Unable to delete habit"); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  async function handleSave() {
    if (!editing || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/habits/" + editing.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription || undefined,
          domain: editDomain,
          frequency: editFrequency,
          difficulty: editDifficulty,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Habit updated");
      setEditing(null);
      await fetchHabits();
    } catch {
      toast.error("Unable to update habit");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading habits...</p>;

  return (
    <>
      {habits.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">No habits yet. Create your first habit to get started!</p>
        </div>
      ) : (
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
      )}

      {/* Edit Habit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit habit</DialogTitle>
            <DialogDescription>Update your habit details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-habit-name">Name</Label>
              <Input id="edit-habit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-habit-description">Description</Label>
              <Textarea id="edit-habit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-habit-domain">Domain</Label>
              {domains.length > 0 ? (
                <Select value={editDomain} onValueChange={setEditDomain}>
                  <SelectTrigger id="edit-habit-domain">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No domains found.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-habit-frequency">Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency}>
                  <SelectTrigger id="edit-habit-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-habit-difficulty">Difficulty</Label>
                <Select value={editDifficulty} onValueChange={setEditDifficulty}>
                  <SelectTrigger id="edit-habit-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
