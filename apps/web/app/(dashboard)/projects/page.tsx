"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  domain: string;
  status?: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchProjects(); fetchDomains(); }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects?sort=-created");
      const data = await res.json();
      setProjects(data.items || []);
    } catch { toast.error("Unable to load projects"); }
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
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Project deleted");
      setProjects((p) => p.filter((x) => x.id !== id));
    } catch { toast.error("Unable to delete project"); }
    finally { setDeleting(false); setDeleteId(null); }
  }

  if (loading) return <p className="text-muted-foreground">Loading projects...</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">Plan and track your work.</p>
        </div>
      </div>
      {projects.length === 0 ? <p className="text-muted-foreground">No projects yet.</p> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <Link href={`/projects/${p.id}`} className="flex-1 text-left font-medium hover:underline">{p.name}</Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setDeleteId(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{domainMap.get(p.domain) || p.domain}</Badge>
                  {p.status && <Badge variant="secondary" className="text-xs">{p.status}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
