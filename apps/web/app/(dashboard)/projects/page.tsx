"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FolderKanban, ExternalLink, MoreHorizontal, Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectCreateDialog } from "@/components/projects/project-create-dialog";
import { ProjectEditDialog } from "@/components/projects/project-edit-dialog";
import Link from "next/link";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  domainId: string;
  color: string | null;
  icon: string | null;
  targetDate: string | null;
  taskCount: number;
  completedCount: number;
  progress: number;
  tags: { id: string; name: string; color: string | null }[];
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch domains
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

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    if (!domainId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/projects`);
      const data = await res.json();
      setProjects(data.items || []);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for custom event to open create dialog
  useEffect(() => {
    const handler = () => setCreateOpen(true);
    document.addEventListener('open-create-project', handler);
    return () => document.removeEventListener('open-create-project', handler);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">Organize work into milestones and track progress.</p>
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
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New project
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="py-12 text-center">
          <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No projects yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="relative">
              <Link href={`/projects/${project.id}`}>
                <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {project.color && (
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                        )}
                        <CardTitle className="text-base">{project.name}</CardTitle>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </div>
                  </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  )}
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${statusColors[project.status] || ''}`}>
                      {project.status}
                    </Badge>
                    {project.targetDate && (
                      <span className="text-xs text-muted-foreground">
                        Due {new Date(project.targetDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{project.completedCount}/{project.taskCount} tasks</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>
                  {project.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {project.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: tag.color || '#e2e8f0', color: '#1e293b' }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
                </Card>
              </Link>
              <div className="absolute right-2 top-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      aria-label={`Options for ${project.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditProject(project); }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setArchiveProject(project); }}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        domainId={domainId || ''}
        onCreated={fetchProjects}
      />

      {editProject && (
        <ProjectEditDialog
          open={!!editProject}
          onOpenChange={(open) => { if (!open) setEditProject(null); }}
          project={editProject}
          domainId={domainId || ''}
          onUpdated={fetchProjects}
        />
      )}

      <AlertDialog open={!!archiveProject} onOpenChange={(open) => { if (!open) setArchiveProject(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive &quot;{archiveProject?.name}&quot;? It will be hidden from the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={async () => {
                if (!archiveProject || !domainId) return;
                setArchiving(true);
                try {
                  const res = await fetch(`/api/domains/${domainId}/projects/${archiveProject.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'archived' }),
                  });
                  if (!res.ok) throw new Error('Failed to archive');
                  toast.success('Project archived');
                  setArchiveProject(null);
                  fetchProjects();
                } catch {
                  toast.error('Failed to archive project');
                } finally {
                  setArchiving(false);
                }
              }}
            >
              {archiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
