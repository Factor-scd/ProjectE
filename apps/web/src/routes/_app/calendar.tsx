import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { useRealtime } from "@/hooks/use-realtime";
import { useOpenCreateDialog } from "@/hooks/use-open-create-dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState, EmptyState } from "@/components/state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { CalendarEvent } from "@/lib/types";
import { format, parseISO, addDays, startOfWeek, getDay } from "date-fns";

// react-big-calendar
import { Calendar, dateFnsLocalizer, Navigate, type View, type stringOrDate } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const localizer = dateFnsLocalizer({
  startOfWeek,
  getDay,
  format,
  locales: {},
});

// Mapped calendar event shape used by react-big-calendar (adds Date start/end accessors)
type CalendarViewEvent = CalendarEvent & { start: Date; end: Date };

const DragAndDropCalendar = withDragAndDrop<CalendarViewEvent>(Calendar);

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
function CustomToolbar({ date, onNavigate, label }: any) {
  const goToBack = () => onNavigate(Navigate.PREVIOUS);
  const goToNext = () => onNavigate(Navigate.NEXT);
  const goToToday = () => onNavigate(Navigate.TODAY);

  return (
    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
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
        <span className="ml-2 text-lg font-semibold font-mono">{label}</span>
      </div>
    </div>
  );
}

function EventForm({ event, onClose }: { event?: CalendarEvent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [title, setTitle] = useState(event?.title || "");
  const [startTime, setStartTime] = useState(event?.startTime ? event.startTime.slice(0, 16) : "");
  const [endTime, setEndTime] = useState(event?.endTime ? event.endTime.slice(0, 16) : "");
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [color, setColor] = useState(event?.color || "#3b82f6");

  const createMutation = useApiMutation<CalendarEvent, any>("post", "/calendar/events", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event created");
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to create event"),
  });

  const updateMutation = useApiMutation<CalendarEvent, any>("patch", event ? `/calendar/events/${event.id}` : "", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event updated");
      onClose();
    },
    onError: (err) => toast.error(err.message || "Failed to update event"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data: any = { title: title.trim(), allDay, color };
    if (startTime) data.startTime = new Date(startTime).toISOString();
    if (endTime) data.endTime = new Date(endTime).toISOString();
    if (event) updateMutation.mutate(data);
    else createMutation.mutate({ ...data, ...(activeDomainId ? { domain: activeDomainId } : {}) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" required />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
        <Label htmlFor="allDay">All day</Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start">Start</Label>
          <Input id="start" type={allDay ? "date" : "datetime-local"} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
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
  const [view, setView] = useState<View>("month");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(-1);

  useRealtime({ enabled: true });

  useOpenCreateDialog("event", () => setCreateOpen(true));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const activeDomainId = useApiDomain();
  const [showTasks, setShowTasks] = useState(true);
  const [showHabits, setShowHabits] = useState(true);
  const [filterProjectId, setFilterProjectId] = useState("");

  const { data: calendarProjectsData } = useApiQuery<{ items: { id: string; name: string }[] }>(
    ["projects", activeDomainId, "calendar"],
    "/projects?limit=200" + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  const fromISO = useMemo(() => { const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); d.setMonth(d.getMonth()-1); return d.toISOString(); }, [date]);
  const toISO = useMemo(() => { const d = new Date(date); d.setMonth(d.getMonth()+2); d.setDate(0); d.setHours(23,59,59,999); return d.toISOString(); }, [date]);

  const { data: eventsData, isLoading: eventsLoading } = useApiQuery<{ items: CalendarEvent[]; totalItems: number }>(
    ["calendar-events", activeDomainId, fromISO, toISO],
    `/calendar/events?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}` + (activeDomainId ? "&domain=" + activeDomainId : "")
  );
  const { data: unifiedData } = useApiQuery<{ items: CalendarEvent[] }>(
    ["calendar-unified", activeDomainId, fromISO, toISO, filterProjectId],
    `/calendar/unified?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}` + (activeDomainId ? "&domain=" + activeDomainId : "") + (filterProjectId ? "&project_id=" + filterProjectId : "")
  );
  const events = useMemo(() => {
    if (!unifiedData?.items) return eventsData?.items || [];
    const base = unifiedData.items;
    if (!showTasks && !showHabits) return base.filter(e => !e.entityType || (e.entityType!=="task" && e.entityType!=="habit"));
    if (!showTasks) return base.filter(e => e.entityType!=="task");
    if (!showHabits) return base.filter(e => e.entityType!=="habit");
    return base;
  }, [unifiedData, eventsData, showTasks, showHabits]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/calendar/events/" + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setEventDetailOpen(false);
      toast.success("Event deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete event"),
  });

  // Map API events to react-big-calendar format
  const calendarEvents = useMemo<CalendarViewEvent[]>(() => {
    return events.map((evt) => ({
      ...evt,
      start: parseISO(evt.startTime),
      end: evt.endTime ? parseISO(evt.endTime) : addDays(parseISO(evt.startTime), 1),
    }));
  }, [events]);

  // Keyboard navigation for calendar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setDate((d) => addDays(d, -1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setDate((d) => addDays(d, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setDate((d) => addDays(d, -7));
          break;
        case "ArrowDown":
          e.preventDefault();
          setDate((d) => addDays(d, 7));
          break;
        case "t":
          e.preventDefault();
          setDate(new Date());
          break;
        case "n":
          e.preventDefault();
          setCreateOpen(true);
          break;
        case "Enter":
          if (selectedEventIndex >= 0 && selectedEventIndex < calendarEvents.length) {
            e.preventDefault();
            setSelectedEvent(calendarEvents[selectedEventIndex]);
            setEventDetailOpen(true);
          }
          break;
        case "Escape":
          if (eventDetailOpen) {
            setEventDetailOpen(false);
          }
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [calendarEvents, selectedEventIndex, eventDetailOpen]);

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedEvent(event as CalendarEvent);
    setEventDetailOpen(true);
  }, []);

  const handleSelectSlot = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: any; start: stringOrDate; end: stringOrDate }) => {
      const isTask = event.entityType === "task" && String(event.id).startsWith("task-");
      const patchUrl = isTask ? `/tasks/${event.entityId}` : `/calendar/events/${event.id}`;
      const patchData = isTask ? { dueDate: (start instanceof Date ? start : new Date(start as string)).toISOString() } : {
        startTime: start instanceof Date ? start.toISOString() : new Date(start as string).toISOString(),
        endTime: end instanceof Date ? end.toISOString() : new Date(end as string).toISOString(),
      };
      api.patch(patchUrl, patchData).then(() => {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-unified"] });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      });
    },
    [queryClient]
  );

  const handleEventResize = useCallback(
    ({ event, start, end }: { event: any; start: stringOrDate; end: stringOrDate }) => {
      if (String(event.id).startsWith("task-") || String(event.id).startsWith("habit-")) return;
      api.patch(`/calendar/events/${event.id}`, {
        startTime: start instanceof Date ? start.toISOString() : new Date(start as string).toISOString(),
        endTime: end instanceof Date ? end.toISOString() : new Date(end as string).toISOString(),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
        queryClient.invalidateQueries({ queryKey: ["calendar-unified"] });
      });
    },
    [queryClient]
  );

  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const handleViewChange = useCallback((newView: string) => {
    setView(newView as View);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Calendar</h1>
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

            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showTasks} onChange={e=>setShowTasks(e.target.checked)} /> Tasks</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showHabits} onChange={e=>setShowHabits(e.target.checked)} /> Habits</label>
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter calendar by project"
          >
            <option value="">All projects</option>
            {(calendarProjectsData?.items || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
        {["month", "week", "day", "agenda"].map((name) => (
          <Button
            key={name}
            variant={view === name ? "default" : "outline"}
            size="sm"
            onClick={() => setView(name as View)}
            className="capitalize"
          >
            {name}
          </Button>
        ))}
        </div>
      </div>
      {eventsLoading && events.length === 0 ? (
        <LoadingState label="Loading events..." />
      ) : !eventsLoading && events.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create your first event to get started"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />New Event
            </Button>
          }
        />
      ) : (
        <div className="rbc-calendar-container" style={{ minHeight: isMobile ? 400 : 600 }}>
          <DragAndDropCalendar
            key={view}
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            date={date}
            view={view}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            popup
            showMultiDayTimes
            components={{
              event: EventComponent,
              toolbar: (props: any) => <CustomToolbar {...props} />,
            }}
            views={["month", "week", "work_week", "day", "agenda"]}
            step={30}
            timeslots={2}
            style={{ height: isMobile ? 400 : 600 }}
          />
        </div>
      )}

      {/* Event detail dialog */}
      <Dialog open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title || "Event"}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              <div className="text-sm">
                <p><strong>Start:</strong> <span className="font-mono">{new Date(selectedEvent.startTime).toLocaleString()}</span></p>
                {selectedEvent.endTime && <p><strong>End:</strong> <span className="font-mono">{new Date(selectedEvent.endTime).toLocaleString()}</span></p>}
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
