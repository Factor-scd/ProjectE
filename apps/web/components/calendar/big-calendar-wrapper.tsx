'use client';

import { useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { useRouter } from 'next/navigation';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DragAndDropCalendar = withDragAndDrop(Calendar as any) as any;

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

interface BigCalendarWrapperProps {
  events: CalendarEvent[];
  onEventDrop?: (event: CalendarEvent, newStart: Date) => void;
  defaultView?: string;
  date?: Date;
  onNavigate?: (date: Date) => void;
  onViewChange?: (view: string) => void;
}

function eventStyleGetter(event: CalendarEvent) {
  const style: React.CSSProperties = {
    backgroundColor: event.color,
    borderRadius: '4px',
    opacity: 0.85,
    color: '#fff',
    border: '0px',
    fontSize: '12px',
    display: 'block',
  };

  if (event.status === 'completed' || event.status === 'done') {
    style.opacity = 0.5;
    style.textDecoration = 'line-through';
  }

  return { style };
}

export function BigCalendarWrapper({
  events,
  onEventDrop,
  defaultView = 'month',
  date,
  onNavigate,
  onViewChange,
}: BigCalendarWrapperProps) {
  const router = useRouter();

  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      router.push(event.href);
    },
    [router]
  );

  const handleEventDrop = useCallback(
    ({ event, start }: { event: CalendarEvent; start: Date }) => {
      if (onEventDrop) {
        onEventDrop(event, start);
      }
    },
    [onEventDrop]
  );

  const handleNavigate = useCallback(
    (newDate: Date) => {
      if (onNavigate) onNavigate(newDate);
    },
    [onNavigate]
  );

  const handleViewChange = useCallback(
    (newView: string) => {
      if (onViewChange) onViewChange(newView);
    },
    [onViewChange]
  );

  const minTime = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maxTime = useMemo(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  return (
    <DragAndDropCalendar
      key={defaultView}
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
      eventPropGetter={eventStyleGetter}
      onSelectEvent={handleSelectEvent}
      views={['month', 'week', 'day']}
      view={defaultView}
      onView={handleViewChange}
      date={date}
      onNavigate={handleNavigate}
      popup
      onEventDrop={handleEventDrop}
      resizable
      step={60}
      timeslots={1}
      min={minTime}
      max={maxTime}
    />
  );
}
