import { useState, useEffect, useRef, useCallback } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Calendar, ChevronLeft, ChevronRight, Plus, Save, Smile, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DailyNote } from "@/lib/types";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns";

// ─── Calendar Sidebar ────────────────────────────────────────────────────

function CalendarSidebar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (d: Date) => void }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(days[0]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Check which dates have notes
  const { data } = useApiQuery<{ items: DailyNote[]; totalItems: number }>(["daily-notes-list"], "/daily-notes");
  const notes = data?.items || [];
  const noteDates = new Set(notes.map((n) => format(parseISO(n.date), "yyyy-MM-dd")));

  return (
    <div className="w-64 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={"empty-" + i} />
        ))}
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const hasNote = noteDates.has(key);
          const isSelected = isSameDay(d, selectedDate);
          const today = isToday(d);
          return (
            <button
              key={key}
              onClick={() => onSelectDate(d)}
              className={cn(
                "h-8 w-8 rounded-full text-xs flex items-center justify-center transition-colors relative",
                isSelected ? "bg-primary text-primary-foreground" : today ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted",
              )}
            >
              {format(d, "d")}
              {hasNote && !isSelected && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <Button variant="outline" size="sm" className="w-full" onClick={() => onSelectDate(new Date())}>
          <Calendar className="h-3.5 w-3.5 mr-2" />Today
        </Button>
      </div>
    </div>
  );
}

// ─── Daily Note Editor ────────────────────────────────────────────────────

function DailyNoteEditor({ date }: { date: Date }) {
  const queryClient = useQueryClient();
  const dateStr = format(date, "yyyy-MM-dd");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: note, isLoading } = useApiQuery<DailyNote | null>(
    ["daily-note", dateStr],
    "/daily-notes?date=" + dateStr
  );

  useEffect(() => {
    if (note) {
      setContent(note.content || "");
      setMood(note.mood);
      setEnergy(note.energy);
      setNoteId(note.id);
      setIsNew(false);
    } else if (!isLoading) {
      setContent("");
      setMood(null);
      setEnergy(null);
      setNoteId(null);
      setIsNew(true);
    }
  }, [note, isLoading, dateStr]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post<DailyNote>("/daily-notes", data),
    onSuccess: (saved) => {
      setNoteId(saved.id);
      setIsNew(false);
      queryClient.invalidateQueries({ queryKey: ["daily-note", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["daily-notes-list"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch<DailyNote>("/daily-notes/" + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-note", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["daily-notes-list"] });
    },
  });

  const autoSave = useCallback((newContent: string, newMood: number | null, newEnergy: number | null) => {
    if (saveTimer) clearTimeout(saveTimer);
    const timer = setTimeout(() => {
      if (noteId) {
        updateMutation.mutate({ id: noteId, data: { content: newContent, mood: newMood, energy: newEnergy } });
      } else if (newContent.trim()) {
        createMutation.mutate({ date: dateStr, content: newContent, mood: newMood, energy: newEnergy });
      }
    }, 1500);
    setSaveTimer(timer);
  }, [noteId, dateStr, saveTimer]);

  const handleContentChange = (value: string) => {
    setContent(value);
    autoSave(value, mood, energy);
  };

  const handleMoodChange = (value: number) => {
    setMood(value);
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: { mood: value } });
    }
  };

  const handleEnergyChange = (value: number) => {
    setEnergy(value);
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: { energy: value } });
    }
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{format(date, "EEEE, MMMM d, yyyy")}</h2>
        <div className="flex items-center gap-2">
          {noteId && (
            <Badge variant="secondary" className="text-[10px]">
              <Save className="h-3 w-3 mr-1" />Saved
            </Badge>
          )}
        </div>
      </div>

      {/* Mood & Energy */}
      <div className="flex gap-6">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Mood</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                onClick={() => handleMoodChange(v)}
                className={cn(
                  "w-6 h-6 rounded text-[10px] font-medium transition-colors",
                  mood === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Energy</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                onClick={() => handleEnergyChange(v)}
                className={cn(
                  "w-6 h-6 rounded text-[10px] font-medium transition-colors",
                  energy === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Editor */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading...</div>
      ) : isNew && !content ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No note for this day &mdash; click to start writing</p>
          <Button variant="outline" onClick={() => textareaRef.current?.focus()}>
            <Plus className="h-4 w-4 mr-2" />Start Writing
          </Button>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write your daily note here..."
          className="w-full min-h-[300px] bg-transparent border-none outline-none resize-none text-base leading-relaxed placeholder:text-muted-foreground/50"
        />
      )}
    </div>
  );
}

// ─── Daily Notes Page ────────────────────────────────────────────────────

function DailyNotesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="flex gap-6 h-[calc(100vh-5rem)]">
      <CalendarSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <Separator orientation="vertical" />
      <ScrollArea className="flex-1 pr-4">
        <DailyNoteEditor date={selectedDate} />
      </ScrollArea>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => appRoute,
  path: "/daily",
  component: DailyNotesPage,
});
