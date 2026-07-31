'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { Filter, ChevronLeft, ChevronRight, CalendarDays, Calendar as CalendarIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

// Lazy load react-big-calendar
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
  type: 'task' | 'habit' | 'project' | 'milestone';
  entityType: string;
  entityId: string;
  color: string;
  domainId: string;
  href: string;
  priority?: string;
  difficulty?: string;
  status?: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [showTasks, setShowTasks] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [domainOptions, setDomainOptions] = useState<{id: string; name: string; color: string | null}[]>([]);
  const [currentDomainId, setCurrentDomainId] = useState<string | null>(null);

  // Auto-switch to day view on mobile
  useEffect(() => {
    const checkWidth = () => {
      if (window.innerWidth < 640 && view !== 'day') {
        setView('day');
      }
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get current domain from URL or default
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    // Try to find domain from sidebar or use first domain
    fetchDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDomains() {
    try {
      const res = await fetch('/api/domains?sort=sort_order');
      if (res.ok) {
        const data = await res.json();
        setDomainOptions(data.items || []);
        if (data.items?.length > 0 && !currentDomainId) {
          setCurrentDomainId(data.items[0].id);
        }
      }
    } catch {}
  }

  const fetchEvents = useCallback(async (domainId: string, from: Date, to: Date) => {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        types: ['task', 'habit', 'project', 'milestone'].join(','),
      });
      const res = await fetch(`/api/domains/${domainId}/calendar/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      const calendarEvents: CalendarEvent[] = (data.events || []).map((e: any) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
      }));
      setEvents(calendarEvents);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setError('Calendar events could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch events when domain or date range changes
  useEffect(() => {
    if (!currentDomainId) return;
    const range = getViewRange(currentDate, view);
    fetchEvents(currentDomainId, range.from, range.to);
  }, [currentDomainId, currentDate, view, fetchEvents]);

  // Calendar keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 't':
          navigate('today');
          e.preventDefault();
          break;
        case 'm':
          setView('month');
          e.preventDefault();
          break;
        case 'w':
          setView('week');
          e.preventDefault();
          break;
        case 'd':
          setView('day');
          e.preventDefault();
          break;
        case 'arrowleft':
          navigate('prev');
          e.preventDefault();
          break;
        case 'arrowright':
          navigate('next');
          e.preventDefault();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, view]);

  function getViewRange(date: Date, v: string): { from: Date; to: Date } {
    const from = new Date(date);
    const to = new Date(date);
    switch (v) {
      case 'month':
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        to.setMonth(to.getMonth() + 1, 0);
        to.setHours(23, 59, 59, 999);
        // Add buffer for week overlap
        from.setDate(from.getDate() - 7);
        to.setDate(to.getDate() + 7);
        break;
      case 'week': {
        const day = from.getDay();
        from.setDate(from.getDate() - day);
        from.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + (6 - day));
        to.setHours(23, 59, 59, 999);
        break;
      }
      case 'day':
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
    }
    return { from, to };
  }

  const navigate = (direction: 'prev' | 'next' | 'today') => {
    const d = new Date(currentDate);
    switch (direction) {
      case 'prev':
        if (view === 'month') d.setMonth(d.getMonth() - 1);
        else if (view === 'week') d.setDate(d.getDate() - 7);
        else d.setDate(d.getDate() - 1);
        break;
      case 'next':
        if (view === 'month') d.setMonth(d.getMonth() + 1);
        else if (view === 'week') d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 1);
        break;
      case 'today':
        d.setTime(Date.now());
        break;
    }
    setCurrentDate(d);
  };

  const handleEventDrop = async (event: CalendarEvent, newStart: Date) => {
    if (event.entityType !== 'task') return;
    try {
      const res = await fetch(`/api/domains/${currentDomainId}/tasks/${event.entityId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: newStart.toISOString() }),
      });
      if (!res.ok) throw new Error('Failed to reschedule');
      // Refresh events
      const range = getViewRange(currentDate, view);
      fetchEvents(currentDomainId!, range.from, range.to);
    } catch (err) {
      console.error('Failed to reschedule task:', err);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.type === 'task' && !showTasks) return false;
      if (event.type === 'habit' && !showHabits) return false;
      if (event.type === 'project' && !showProjects) return false;
      if (event.type === 'milestone' && !showMilestones) return false;
      if (selectedDomains.length > 0 && !selectedDomains.includes(event.domainId)) return false;
      return true;
    });
  }, [events, showTasks, showHabits, showProjects, showMilestones, selectedDomains]);

  const toggleDomain = (domainId: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((d) => d !== domainId) : [...prev, domainId]
    );
  };

  const formatTitle = () => {
    const opts: Intl.DateTimeFormatOptions = {};
    if (view === 'month') { opts.month = 'long'; opts.year = 'numeric'; }
    else if (view === 'week') { opts.month = 'short'; opts.day = 'numeric'; }
    else { opts.weekday = 'long'; opts.month = 'long'; opts.day = 'numeric'; opts.year = 'numeric'; }
    return currentDate.toLocaleDateString('en-US', opts);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="mt-1 text-muted-foreground">Your commitments, in time.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('today')}>
          <CalendarIcon className="mr-1 h-4 w-4" />
          Today
        </Button>
        <div className="flex">
          <Button variant="ghost" size="icon" onClick={() => navigate('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="min-w-[180px] text-lg font-semibold">{formatTitle()}</h2>
        <div className="ml-auto flex rounded-lg border">
          {(['month', 'week', 'day'] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none capitalize"
              onClick={() => setView(v)}
            >
              {v}
            </Button>
          ))}
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
              <h3 className="text-sm font-semibold">Show</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="tasks" checked={showTasks} onCheckedChange={(c) => setShowTasks(c === true)} />
                  <Label htmlFor="tasks" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
                    Tasks
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="habits" checked={showHabits} onCheckedChange={(c) => setShowHabits(c === true)} />
                  <Label htmlFor="habits" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#22c55e' }} />
                    Habits
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="projects" checked={showProjects} onCheckedChange={(c) => setShowProjects(c === true)} />
                  <Label htmlFor="projects" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#8b5cf6' }} />
                    Projects
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="milestones" checked={showMilestones} onCheckedChange={(c) => setShowMilestones(c === true)} />
                  <Label htmlFor="milestones" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
                    Milestones
                  </Label>
                </div>
              </div>
            </div>

            {/* Domains */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Domains</h3>
              <div className="space-y-2">
                {domainOptions.map((domain) => (
                  <div key={domain.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={domain.id}
                      checked={selectedDomains.includes(domain.id)}
                      onCheckedChange={() => toggleDomain(domain.id)}
                    />
                    <Label htmlFor={domain.id}>
                      <Badge variant="outline">{domain.name}</Badge>
                    </Label>
                  </div>
                ))}
              </div>
              {selectedDomains.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDomains([])} className="text-xs">
                  Clear filters
                </Button>
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">Legend</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>• Tasks show on due date (color = priority)</p>
                <p>• Habits show daily (color = difficulty)</p>
                <p>• Projects show on deadline</p>
                <p>• Milestones show on due date</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            {error ? (
              <div className="flex flex-col items-center gap-4 py-20">
                <p className="text-muted-foreground" role="alert">{error}</p>
                <Button onClick={() => {
                  const range = getViewRange(currentDate, view);
                  if (currentDomainId) fetchEvents(currentDomainId, range.from, range.to);
                }}>
                  Retry
                </Button>
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="flex h-[600px] items-center justify-center rounded-lg border bg-muted/30">
                    <div className="animate-pulse text-sm text-muted-foreground">Loading calendar...</div>
                  </div>
                }
              >
                <BigCalendar key={view}
                  events={filteredEvents}
                  onEventDrop={handleEventDrop}
                  defaultView={view}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onViewChange={(v: string) => setView(v as 'month' | 'week' | 'day')}
                />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
