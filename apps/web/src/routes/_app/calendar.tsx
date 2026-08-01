import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/lib/types";
import { format, parseISO, addDays, startOfWeek, getDay } from "date-fns";

// react-big-calendar
import { Calendar, dateFnsLocalizer, Views, Navigate } from "react-big-calendar";
// import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  startOfWeek,
  getDay,
  format,
  locales: {},
});

// const DragAndDropCalendar = withDragAndDrop(Calendar);

// Color palette: tasks=accent, events by domain
const EVENT_COLORS: Record<string, string> = {
  task: "var(--accent-hsl, 217 91% 60%)",
  habit: "142 71% 45%",
  project: "271 81% 56%",
  note: "24 95% 53%",
  default: "215 16% 47%",
};

function eventColor(event: CalendarEvent): string {
  const hue = event.entityType ? EVENT_COLORS[event.entityType] || EVENT_COLORS.default : EVENT_COLORS.default;
  return `hsl(${hue})`;
}

function eventBg(event: CalendarEvent): string {
  const hue = event.entityType ? EVENT_COLORS[event.entityType] || EVENT_COLORS.default : EVENT_COLORS.default;
  return `hsla(${hue}, 0.15)`;
}

// Custom event component
function EventComponent({ event }: { event: CalendarEvent }) {
  return (
    <div
      className="rbc-event-content truncate px-1 py-0.5 text-xs"
      style={{
        borderLeft: `3px solid ${eventColor(event)}`,
        backgroundColor: eventBg(event),
        color: eventColor(event),
      }}
    >
      {event.title}
    </div>
  );
}

// Custom toolbar
function CustomToolbar({ date, onNavigate, onView, currentView, label }: any) {
  const goToBack = () => onNavigate(Navigate.PREVIOUS);
  const goToNext = () => onNavigate(Navigate.NEXT);
  const goToToday = () => onNavigate(Navigate.TODAY);

  const viewNames = ["month", "week", "day", "agenda"];

  return (
    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={goToBack} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={goToNext} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-lg font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {viewNames.map((name) => (
          <Button
            key={name}
            variant={currentView === name ? "default" : "outline"}
            size="sm"
            onClick={() => onView(name)}
            className="capitalize"
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function EventForm({ event, onClose }: { event?: CalendarEvent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event?.title || "");
  const [startTime, setStartTime] = useState(event?.startTime ? event.startTime.slice(0, 16) : "");
  const [endTime, setEndTime] = useState(event?.endTime ? event.endTime.slice(0, 16) : "");
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [color, setColor] = useState(event?.color || "#3b82f6");

  const createMutation = useApiMutation<CalendarEvent, any>("post", "/calendar/events", {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); onClose(); },
  });

  const updateMutation = useApiMutation<CalendarEvent, any>("patch", event ? `/calendar/events/${event.id}` : "", {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data: any = { title: title.trim(), allDay, color };
    if (startTime) data.startTime = new Date(startTime).toISOString();
    if (endTime) data.endTime = new Date(endTime).toISOString();
    if (event) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" required />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
        <Label htmlFor="allDay">All day</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start">Start</Label>
          <Input id="start" type={allDay ? "date" : "datetime-local"} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="end">End</Label>
          <Input id="end" type={allDay ? "date" : "datetime-local"} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="color">Color</Label>
        <Input id="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{event ? "Update" : "Create"} Event</Button>
      </div>
    </form>
  );
}

function CalendarPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<string>("month");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useRealtime({ enabled: true });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);


  const { data: eventsData } = useApiQuery<{ items: CalendarEvent[]; totalItems: number }>(
    ["calendar-events", date.toISOString()],
    `/calendar/events?from=${new Date(0).toISOString()}&to=${new Date("2100-01-01").toISOString()}`
  );

  const events = eventsData?.items || [];

  const deleteMutation = useApiMutation<any, string>("delete", "", {
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); setEventDetailOpen(false); },
  });

  // Map API events to react-big-calendar format
  const calendarEvents = useMemo(() => {
    return events.map((evt) => ({
      ...evt,
      start: parseISO(evt.startTime),
      end: evt.endTime ? parseISO(evt.endTime) : addDays(parseISO(evt.startTime), 1),
    }));
  }, [events]);

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedEvent(event as CalendarEvent);
    setEventDetailOpen(true);
  }, []);

  const handleSelectSlot = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: any; start: Date; end: Date }) => {
      api.patch(`/calendar/events/${event.id}`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      });
    },
    [queryClient]
  );

  const handleEventResize = useCallback(
    ({ event, start, end }: { event: any; start: Date; end: Date }) => {
      api.patch(`/calendar/events/${event.id}`, {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      });
    },
    [queryClient]
  );

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: string) => {
    setView(newView);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button aria-label="New event"><Plus className="h-4 w-4 mr-2" />New Event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
            <EventForm onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rbc-calendar-container" style={{ minHeight: isMobile ? 400 : 600 }}>
        {/* Key={view} forces remount on view change (workaround for react-big-calendar DnD day view issue) */}
        <Calendar
          key={'cal-' + view + '-' + (isMobile ? 'm' : 'd')}
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          date={date}
          view={view}
          defaultView={isMobile ? Views.AGENDA : Views.MONTH}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          showMultiDayTimes
          components={{
            event: EventComponent,
            toolbar: (props: any) => (
              <CustomToolbar
                {...props}
                currentView={view}
                onView={(newView: string) => setView(newView)}
              />
            ),
          }}
          views={["month", "week", "work_week", "day", "agenda"]}
          step={30}
          timeslots={2}
          style={{ height: isMobile ? 400 : 600 }}
        />
      </div>

      {/* Event detail dialog */}
      <Dialog open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event"}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="text-sm">
                <p><strong>Start:</strong> {new Date(selectedEvent.startTime).toLocaleString()}</p>
                {selectedEvent.endTime && <p><strong>End:</strong> {new Date(selectedEvent.endTime).toLocaleString()}</p>}
                {selectedEvent.description && <p className="mt-2">{selectedEvent.description}</p>}
              </div>
              <EventForm event={selectedEvent} onClose={() => setEventDetailOpen(false)} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Event</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Event</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete "{selectedEvent.title}"?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(selectedEvent.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/calendar",
  component: CalendarPage,
});
