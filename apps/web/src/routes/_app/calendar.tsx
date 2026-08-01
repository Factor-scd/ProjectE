import { useState, useMemo } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { useRealtime } from "@/hooks/use-realtime";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { CalendarEvent, PaginatedResponse } from "@/lib/types";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";

function EventForm({ event, onClose }: { event?: CalendarEvent; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event?.title || "");
  const [startTime, setStartTime] = useState(event?.startTime ? event.startTime.slice(0, 16) : "");
  const [endTime, setEndTime] = useState(event?.endTime ? event.endTime.slice(0, 16) : "");
  const [allDay, setAllDay] = useState(event?.allDay || false);
  const [color, setColor] = useState(event?.color || "#3b82f6");

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<CalendarEvent>("/calendar/events", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); onClose(); },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch<CalendarEvent>("/calendar/events/" + event!.id, data),
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  useRealtime({ enabled: true });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: eventsData } = useApiQuery<{ items: CalendarEvent[]; totalItems: number }>(
    ["calendar-events", currentMonth.toISOString()],
    "/calendar/events?from=" + calStart.toISOString() + "&to=" + calEnd.toISOString()
  );

  const events = eventsData?.items || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete("/calendar/events/" + id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); setEventDetailOpen(false); },
  });

  const dayEvents = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = new Date(event.startTime).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

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

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date())} aria-label="Today">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg">
        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvts = dayEvents.get(key) || [];
            return (
              <div
                key={key}
                className={cn(
                  "min-h-[100px] p-1 border-b border-r last:border-r-0 cursor-pointer hover:bg-accent/50 transition-colors",
                  !isSameMonth(day, currentMonth) && "text-muted-foreground/50",
                  isToday(day) && "bg-accent/30"
                )}
                onClick={() => setSelectedDate(day)}
              >
                <div className={cn(
                  "text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvts.slice(0, 3).map((evt) => (
                    <div
                      key={evt.id}
                      className="text-[10px] truncate rounded px-1 py-0.5 cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: evt.color || "#3b82f6" + "20", color: evt.color || "#3b82f6", borderLeft: "2px solid " + (evt.color || "#3b82f6") }}
                      onClick={(e) => { e.stopPropagation(); setSelectedEvent(evt); setEventDetailOpen(true); }}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {dayEvts.length > 3 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayEvts.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
