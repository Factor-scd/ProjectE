'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { CreateItemDialog } from '@/components/create-item-dialog';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  domain: string;
  progress: number;
  task_count: number;
  completed_count: number;
  due_date?: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === 'true') setCreateOpen(true);
  }, []);

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    if (!open && new URLSearchParams(window.location.search).get('new') === 'true') {
      window.history.replaceState(null, '', '/projects');
    }
  }

  async function fetchProjects() {
    try {
      setError(null);
      const response = await fetch('/api/projects?sort=-created');
      if (!response.ok) throw new Error('Unable to load projects.');
      const data = await response.json();
      setProjects(data.items || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setError('Unable to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p role="status" className="text-muted-foreground">Loading projects...</p>;
  }

  const activeProjects = projects.filter((p) => p.status === 'active');
  const pausedProjects = projects.filter((p) => p.status === 'paused');
  const archivedProjects = projects.filter((p) => p.status === 'archived');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-muted-foreground">Every outcome has a home.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New project
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchProjects}>Retry</Button>
        </div>
      )}

      {/* Active projects */}
      {activeProjects.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Active Projects</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Paused projects */}
      {pausedProjects.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Paused Projects</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pausedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {/* Archived projects */}
      {archivedProjects.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Archived Projects</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {archivedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-semibold">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first project to get started
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>Create a project</Button>
          </CardContent>
        </Card>
      )}
      <CreateItemDialog
        type="project"
        open={createOpen}
        onOpenChange={handleCreateOpenChange}
        onCreated={fetchProjects}
      />
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base">{project.name}</CardTitle>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
            <Badge
              variant={
                project.status === 'active'
                  ? 'default'
                  : project.status === 'paused'
                    ? 'secondary'
                    : 'outline'
              }
              className="ml-2 shrink-0"
            >
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" aria-label={`${project.name} progress: ${project.progress}%`} />
          </div>

          {/* Task count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tasks</span>
            <span className="font-semibold">
              {project.completed_count} / {project.task_count}
            </span>
          </div>

          {/* Domain and due date */}
          <div className="flex items-center justify-between text-xs">
            <Badge variant="outline">{project.domain}</Badge>
            {project.due_date && (
              <span className="text-muted-foreground">
                Due: {new Date(project.due_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
