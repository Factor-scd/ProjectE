'use client';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';

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

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'task' | 'habit' | 'project' | 'milestone';
  domain: string;
  color: string;
}

interface BigCalendarWrapperProps {
  events: CalendarEvent[];
}

function eventStyleGetter(event: CalendarEvent) {
  return {
    style: {
      backgroundColor: event.color,
      borderRadius: '4px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      fontSize: '12px',
    },
  };
}

function handleSelectEvent(event: CalendarEvent) {
  console.log('Selected event:', event);
}

export function BigCalendarWrapper({ events }: BigCalendarWrapperProps) {
  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 600 }}
      eventPropGetter={eventStyleGetter}
      onSelectEvent={handleSelectEvent}
      views={['month', 'week', 'day']}
      defaultView="month"
      popup
      toolbar
    />
  );
}
