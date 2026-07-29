"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, ArrowLeft, GripVertical, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

  // Extract domainId from the project data
  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      // We need to find the domain first — use the first domain
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

  // Group tasks by section
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
              <span className="text-xs text-muted-foreground">
                {(tasksBySection.get(section.id) || []).length}
              </span>
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
    </div>
  );
}
