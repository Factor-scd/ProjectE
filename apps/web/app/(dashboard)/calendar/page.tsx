'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { Filter } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Lazy load react-big-calendar (~60KB + date-fns)
const BigCalendar = dynamic(
  () => import('@/components/calendar/big-calendar-wrapper').then((m) => m.BigCalendarWrapper),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center rounded-lg border bg-muted/30">
        <div className="animate-pulse text-sm text-muted-foreground">Loading calendar...</div>
      </div>
    ),
  }
);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'task' | 'project' | 'milestone';
  domain: string;
  color: string;
  href: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    setLoading(true);
    setError(null);
    try {
      const [tasksResponse, projectsResponse, milestonesResponse] = await Promise.all([
        fetch('/api/tasks?perPage=500'),
        fetch('/api/projects?perPage=500'),
        fetch('/api/milestones?perPage=500'),
      ]);

      if (!tasksResponse.ok || !projectsResponse.ok || !milestonesResponse.ok) {
        throw new Error('One or more calendar sources could not be loaded.');
      }

      const [tasksData, projectsData, milestonesData] = await Promise.all([
        tasksResponse.json(),
        projectsResponse.json(),
        milestonesResponse.json(),
      ]);

      const calendarEvents: CalendarEvent[] = [];

      // Add tasks
      if (tasksData.items) {
        for (const task of tasksData.items) {
          if (task.due_date) {
            const date = new Date(task.due_date);
            calendarEvents.push({
              id: `task-${task.id}`,
              title: task.title,
              start: date,
              end: date,
              type: 'task',
              domain: task.domain ?? 'personal',
              color: '#3b82f6',
              href: '/tasks',
            });
          }
        }
      }

      // Add projects
      if (projectsData.items) {
        for (const project of projectsData.items) {
          if (project.due_date) {
            const date = new Date(project.due_date);
            calendarEvents.push({
              id: `project-${project.id}`,
              title: project.name,
              start: date,
              end: date,
              type: 'project',
              domain: project.domain ?? 'personal',
              color: '#8b5cf6',
              href: `/projects/${project.id}`,
            });
          }
        }
      }

      // Add milestones
      if (milestonesData.items) {
        for (const milestone of milestonesData.items) {
          if (milestone.due_date) {
            const date = new Date(milestone.due_date);
            calendarEvents.push({
              id: `milestone-${milestone.id}`,
              title: milestone.name || milestone.title,
              start: date,
              end: date,
              type: 'milestone',
              domain: milestone.domain ?? 'work',
              color: '#f59e0b',
              href: milestone.project_id ? `/projects/${milestone.project_id}` : '/projects',
            });
          }
        }
      }

      setEvents(calendarEvents);
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);
      setError('Calendar events could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter by type
      if (event.type === 'task' && !showTasks) return false;
      if (event.type === 'project' && !showProjects) return false;
      if (event.type === 'milestone' && !showMilestones) return false;

      // Filter by domain
      if (selectedDomains.length > 0 && !selectedDomains.includes(event.domain)) {
        return false;
      }

      return true;
    });
  }, [events, showTasks, showProjects, showMilestones, selectedDomains]);

  function toggleDomain(domain: string) {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground" role="alert">{error}</p>
        <Button onClick={fetchEvents}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="mt-1 text-muted-foreground">Your commitments, in time.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr]">
        {/* Filters sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Entity types */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Show</h2>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tasks"
                    checked={showTasks}
                    onCheckedChange={(checked) => setShowTasks(checked === true)}
                  />
                  <Label htmlFor="tasks" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
                    Tasks
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="projects"
                    checked={showProjects}
                    onCheckedChange={(checked) => setShowProjects(checked === true)}
                  />
                  <Label htmlFor="projects" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#8b5cf6' }} />
                    Projects
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="milestones"
                    checked={showMilestones}
                    onCheckedChange={(checked) => setShowMilestones(checked === true)}
                  />
                  <Label htmlFor="milestones" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                    Milestones
                  </Label>
                </div>
              </div>
            </div>

            {/* Domains */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Domains</h2>
              <div className="space-y-2">
                {['personal', 'work', 'ots'].map((domain) => (
                  <div key={domain} className="flex items-center space-x-2">
                    <Checkbox
                      id={domain}
                      checked={selectedDomains.includes(domain)}
                      onCheckedChange={() => toggleDomain(domain)}
                    />
                    <Label htmlFor={domain}>
                      <Badge variant="outline">{domain}</Badge>
                    </Label>
                  </div>
                ))}
              </div>
              {selectedDomains.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDomains([])}
                  className="text-xs"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2 border-t pt-4">
              <h2 className="text-sm font-semibold">Legend</h2>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Tasks show on due date</p>
                <p>• Projects show on deadline</p>
                <p>• Milestones show on due date</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <Suspense
              fallback={
                <div className="flex h-[600px] items-center justify-center rounded-lg border bg-muted/30">
                  <div className="animate-pulse text-sm text-muted-foreground">Loading calendar...</div>
                </div>
              }
            >
              <BigCalendar events={filteredEvents} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
