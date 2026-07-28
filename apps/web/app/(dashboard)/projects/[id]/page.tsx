'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, Circle, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

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

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  due_date?: string;
  status: 'planned' | 'in_progress' | 'completed';
  completed_tasks: number;
  total_tasks: number;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainMap, setDomainMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (projectId) {
      fetchDomains();
      fetchProject();
      fetchTasks();
      fetchMilestones();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, string>();
        for (const d of data.items || []) map.set(d.id, d.name);
        setDomainMap(map);
      }
    } catch {}
  }

  async function fetchProject() {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  }

  async function fetchTasks() {
    try {
      const response = await fetch(
        `/api/tasks?filter=project_id%3D%22${projectId}%22&sort=-created`
      );
      if (response.ok) {
        const data = await response.json();
        setTasks(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMilestones() {
    try {
      const response = await fetch(
        `/api/milestones?filter=project_id%3D%22${projectId}%22&sort=due_date`
      );
      if (response.ok) {
        const data = await response.json();
        setMilestones(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    }
  }

  async function toggleTaskComplete(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTasks();
      fetchProject();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  if (loading || !project) {
    return <p className="text-muted-foreground">Loading project...</p>;
  }

  return (
    <div>
      {/* Back button */}
      <Link href="/projects">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to projects
        </Button>
      </Link>

      {/* Project header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                project.status === 'active'
                  ? 'default'
                  : project.status === 'paused'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {project.status}
            </Badge>
            <Badge variant="outline">{domainMap.get(project.domain) || project.domain}</Badge>
          </div>
        </div>

        {/* Project stats */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold">{project.progress}%</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
              </div>
              <Progress value={project.progress} className="mt-2 h-2" aria-label={`${project.name} progress: ${project.progress}%`} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks</p>
                  <p className="text-2xl font-bold">
                    {project.completed_count} / {project.task_count}
                  </p>
                </div>
                <Circle className="h-8 w-8 text-blue-600" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-2xl font-bold">
                    {project.due_date
                      ? new Date(project.due_date).toLocaleDateString()
                      : 'No date'}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="milestones">
            Milestones ({milestones.length})
          </TabsTrigger>
          <TabsTrigger value="habits">Habits</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No tasks yet
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0"
                        onClick={() =>
                          toggleTaskComplete(task.id, task.status)
                        }
                        aria-label={`Mark "${task.title}" as ${task.status === 'done' ? 'incomplete' : 'complete'}`}
                      >
                        {task.status === 'done' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </Button>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            task.status === 'done'
                              ? 'text-muted-foreground line-through'
                              : ''
                          }`}
                        >
                          {task.title}
                        </p>
                      </div>
                      <Badge
                        variant={
                          task.priority === 'urgent'
                            ? 'destructive'
                            : task.priority === 'high'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {task.priority}
                      </Badge>
                      {task.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              {milestones.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No milestones yet
                </p>
              ) : (
                <div className="space-y-4">
                  {milestones.map((milestone, index) => (
                    <div key={milestone.id} className="relative flex gap-4">
                      {/* Timeline line */}
                      {index < milestones.length - 1 && (
                        <div className="absolute left-5 top-12 h-full w-0.5 bg-border" />
                      )}

                      {/* Milestone marker */}
                      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background">
                        <Flag
                          className={`h-5 w-5 ${
                            milestone.status === 'completed'
                              ? 'text-green-600'
                              : milestone.status === 'in_progress'
                                ? 'text-blue-600'
                                : 'text-muted-foreground'
                          }`}
                          aria-hidden="true"
                        />
                      </div>

                      {/* Milestone content */}
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h2 className="font-semibold">
                              {milestone.name}
                            </h2>
                            {milestone.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {milestone.description}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant={
                              milestone.status === 'completed'
                                ? 'default'
                                : milestone.status === 'in_progress'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {milestone.status}
                          </Badge>
                        </div>
                        {milestone.due_date && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Due:{' '}
                            {new Date(
                              milestone.due_date
                            ).toLocaleDateString()}
                          </p>
                        )}
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Tasks
                            </span>
                            <span>
                              {milestone.completed_tasks} /{' '}
                              {milestone.total_tasks}
                            </span>
                          </div>
                          <Progress
                            value={
                              milestone.total_tasks > 0
                                ? (milestone.completed_tasks /
                                    milestone.total_tasks) *
                                  100
                                : 0
                            }
                            className="h-1.5"
                            aria-label={`${milestone.name} task progress: ${milestone.completed_tasks} of ${milestone.total_tasks}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="habits" className="mt-6">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Habits linked to this project will appear here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Notes linked to this project will appear here
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
