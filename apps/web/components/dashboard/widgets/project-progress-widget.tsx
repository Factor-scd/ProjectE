'use client';

import { useEffect, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Project {
  id: string;
  name: string;
  progress: number;
}

export function ProjectProgressWidget() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const response = await fetch(
        '/api/projects?filter=status%3D%22active%22&perPage=5'
      );
      if (response.ok) {
        const data = await response.json();
        setProjects(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="p-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderKanban className="h-4 w-4" aria-hidden="true" />
          Active Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active projects</p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm">{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {project.progress}%
                  </span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
