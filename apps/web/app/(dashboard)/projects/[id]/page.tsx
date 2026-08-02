"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, ArrowLeft, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SectionDialog } from "@/components/projects/section-dialog";
import Link from "next/link";
import { toast } from "sonner";

interface Section {
  id: string;
  name: string;
  projectId: string;
  kind: 'section' | 'milestone';
  status: 'planned' | 'in_progress' | 'complete';
  targetDate: string | null;
  sortOrder: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  sectionId: string | null;
  order: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  icon: string | null;
  targetDate: string | null;
  sections: Section[];
  tasks: Task[];
  taskCount: number;
  completedCount: number;
  progress: number;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const taskStatusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionName, setEditSectionName] = useState("");
  const [editSectionKind, setEditSectionKind] = useState<"section" | "milestone">("section");
  const [editSectionStatus, setEditSectionStatus] = useState<"planned" | "in_progress" | "complete">("planned");
  const [editSectionSaving, setEditSectionSaving] = useState(false);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [deleteSectionDeleting, setDeleteSectionDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const domainsRes = await fetch('/api/domains?sort=sort_order');
      const domainsData = await domainsRes.json();
      const firstDomain = domainsData.items?.[0];
      if (!firstDomain) {
        setLoading(false);
        return;
      }
      setDomainId(firstDomain.id);
      const res = await fetch(`/api/domains/${firstDomain.id}/projects/${projectId}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setProject(data);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleMoveTask = async (taskId: string, sectionId: string | null) => {
    try {
      const res = await fetch(`/api/domains/${domainId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId }),
      });
      if (!res.ok) throw new Error('Failed to move task');
      toast.success('Task moved');
      fetchProject();
    } catch {
      toast.error('Failed to move task');
    }
  };

  // Edit section
  const handleEditSection = async () => {
    if (!editingSection || !editSectionName.trim() || !domainId) return;
    setEditSectionSaving(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/projects/${projectId}/sections/${editingSection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editSectionName.trim(),
          kind: editSectionKind,
          status: editSectionStatus,
        }),
      });
      if (!res.ok) throw new Error('Failed to update section');
      toast.success('Section updated');
      setEditingSection(null);
      fetchProject();
    } catch {
      toast.error('Failed to update section');
    } finally {
      setEditSectionSaving(false);
    }
  };

  // Delete section
  const handleDeleteSection = async () => {
    if (!deleteSectionId || !domainId) return;
    setDeleteSectionDeleting(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/projects/${projectId}/sections/${deleteSectionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete section');
      toast.success('Section deleted');
      setDeleteSectionId(null);
      fetchProject();
    } catch {
      toast.error('Failed to delete section');
    } finally {
      setDeleteSectionDeleting(false);
    }
  };

  // Open edit section dialog
  const openEditSection = (section: Section) => {
    setEditSectionName(section.name);
    setEditSectionKind(section.kind);
    setEditSectionStatus(section.status);
    setEditingSection(section);
  };

  // Listen for custom event to open section dialog
  useEffect(() => {
    const handler = () => setSectionDialogOpen(true);
    document.addEventListener('open-create-section', handler);
    return () => document.removeEventListener('open-create-section', handler);
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Link href="/projects" className="mt-4 inline-block text-primary hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  const tasksBySection = new Map<string | 'unsectioned', Task[]>();
  tasksBySection.set('unsectioned', []);
  for (const section of project.sections) {
    tasksBySection.set(section.id, []);
  }
  for (const task of project.tasks) {
    const key = task.sectionId || 'unsectioned';
    if (!tasksBySection.has(key)) tasksBySection.set(key, []);
    tasksBySection.get(key)!.push(task);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/projects" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {project.color && (
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              )}
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge variant="secondary" className={`text-xs ${statusColors[project.status] || ''}`}>
                {project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="mt-1 text-muted-foreground">{project.description}</p>
            )}
            {project.targetDate && (
              <p className="mt-1 text-sm text-muted-foreground">
                Target: {new Date(project.targetDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{project.completedCount}/{project.taskCount} tasks completed</span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>
      </div>

      {/* Sections board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Unsectioned tasks column */}
        <div className="min-w-[280px] max-w-[320px] flex-shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Unassigned
            </h3>
            <span className="text-xs text-muted-foreground">
              {(tasksBySection.get('unsectioned') || []).length}
            </span>
          </div>
          <div className="space-y-2">
            {(tasksBySection.get('unsectioned') || []).map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={() => setDraggedTaskId(task.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedTaskId && draggedTaskId !== task.id) {
                    handleMoveTask(draggedTaskId, null);
                  }
                  setDraggedTaskId(null);
                }}
                className="rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="text-sm flex-1">{task.title}</span>
                  <Badge variant="secondary" className={`text-xs ${taskStatusColors[task.status] || ''}`}>
                    {task.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(tasksBySection.get('unsectioned') || []).length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Drop tasks here
              </div>
            )}
          </div>
        </div>

        {/* Section columns */}
        {project.sections.map((section) => (
          <div key={section.id} className="min-w-[280px] max-w-[320px] flex-shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.name}
                </h3>
                {section.kind === 'milestone' && (
                  <Badge variant="outline" className="text-xs">Milestone</Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {(tasksBySection.get(section.id) || []).length}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditSection(section)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteSectionId(section.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div
              className="space-y-2 min-h-[100px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedTaskId) {
                  handleMoveTask(draggedTaskId, section.id);
                }
                setDraggedTaskId(null);
              }}
            >
              {(tasksBySection.get(section.id) || []).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDraggedTaskId(task.id)}
                  className="rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="text-sm flex-1">{task.title}</span>
                    <Badge variant="secondary" className={`text-xs ${taskStatusColors[task.status] || ''}`}>
                      {task.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {(tasksBySection.get(section.id) || []).length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add section button */}
        <div className="min-w-[280px] max-w-[320px] flex-shrink-0">
          <button
            onClick={() => setSectionDialogOpen(true)}
            className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground hover:text-foreground hover:border-accent-foreground/50 transition-colors"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add section
          </button>
        </div>
      </div>

      <SectionDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        projectId={projectId}
        domainId={domainId || ''}
        onCreated={fetchProject}
      />

      {/* Edit Section Dialog */}
      <Dialog open={!!editingSection} onOpenChange={(open) => { if (!open) setEditingSection(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
            <DialogDescription>Update section details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-section-name">Name</Label>
              <Input id="edit-section-name" value={editSectionName} onChange={(e) => setEditSectionName(e.target.value)} autoFocus required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-section-kind">Kind</Label>
                <Select value={editSectionKind} onValueChange={(v: any) => setEditSectionKind(v)}>
                  <SelectTrigger id="edit-section-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-section-status">Status</Label>
                <Select value={editSectionStatus} onValueChange={(v: any) => setEditSectionStatus(v)}>
                  <SelectTrigger id="edit-section-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button>
            <Button onClick={handleEditSection} disabled={editSectionSaving || !editSectionName.trim()}>
              {editSectionSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Confirmation */}
      <AlertDialog open={!!deleteSectionId} onOpenChange={(open) => { if (!open) setDeleteSectionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete section?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Tasks in this section will become unassigned.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSectionDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSection} disabled={deleteSectionDeleting}>
              {deleteSectionDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
