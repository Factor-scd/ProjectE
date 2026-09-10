import { useState, useEffect, useRef, useCallback } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as appRoute } from "../_app";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery, useApiMutation } from "@/lib/api";
import { Calendar, ChevronLeft, ChevronRight, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import type { DailyNote } from "@/lib/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns";

// ─── Calendar Sidebar ────────────────────────────────────────────────────

function CalendarSidebar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (d: Date) => void }) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = getDay(days[0]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Check which dates have notes
  const activeDomainId = useApiDomain();
  const { data } = useApiQuery<{ items: DailyNote[]; totalItems: number }>(["daily-notes-list", activeDomainId], "/daily-notes" + (activeDomainId ? "?domain=" + activeDomainId : ""));
  const notes = data?.items || [];
  const noteDates = new Set(notes.map((n) => n.date.slice(0, 10)));

  return (
    <div className="w-full md:w-56 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-semibold font-mono">{format(currentMonth, "MMM yyyy")}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center">
        {dayNames.map((d) => (
          <div key={d} className="text-[9px] text-muted-foreground font-mono font-medium py-0.5">{d}</div>
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
                "h-7 w-7 rounded text-[11px] font-mono flex items-center justify-center transition-colors relative",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : today
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/40 text-foreground",
              )}
            >
              {format(d, "d")}
              {hasNote && !isSelected && (
                <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2">
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => onSelectDate(new Date())}>
          <Calendar className="h-3 w-3 mr-1.5" />Today
        </Button>
      </div>
    </div>
  );
}

  // ─── Daily Note Editor ────────────────────────────────────────────────────

function DailyNoteEditor({ date }: { date: Date }) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const domainSuffix = activeDomainId ? "&domain=" + activeDomainId : "";
  const dateStr = format(date, "yyyy-MM-dd");
  const { data: tasksData } = useApiQuery<{ items: Array<{ id:string; title:string; status:string; dueDate:string|null }> }>(["tasks-daily", dateStr, activeDomainId], "/tasks?limit=50" + (activeDomainId ? "&domain=" + activeDomainId : ""));
  const { data: habitsData } = useApiQuery<{ items: Array<{ id:string; name:string }> }>(["habits-daily", activeDomainId], "/habits?limit=50" + (activeDomainId ? "&domain=" + activeDomainId : ""));
  const tasksDue = (tasksData?.items || []).filter(t => t.dueDate && t.dueDate.slice(0,10) === dateStr && t.status !== "done");
  const habitsToday = habitsData?.items || [];
  const insertTemplate = () => {
    const tpl = `# ${format(date, "EEEE, MMM d")}\n\n## Tasks Due Today\n${tasksDue.length ? tasksDue.map(t => `- [ ] ${t.title}`).join("\n") : "- No tasks due"}\n\n## Habits\n${habitsToday.slice(0,5).map(h => `- [ ] ${h.name}`).join("\n") || "- No habits"}\n\n## Notes\n`;
    setContent(tpl);
    autoSave(tpl, mood, energy);
  };
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDateStrRef = useRef(dateStr);

  // Mirror noteId into a ref so a pending autosave timer can always read the
  // latest id. Without this, a timer scheduled while no note existed yet would
  // fire with a stale null and double-create the note once createMutation
  // resolves (noteId is set asynchronously in onSuccess).
  noteIdRef.current = noteId;

  const { data: note, isLoading } = useApiQuery<DailyNote | null>(
    ["daily-note", dateStr, activeDomainId],
    "/daily-notes?date=" + dateStr + domainSuffix
  );

  useEffect(() => {
    // Switching days must cancel any pending autosave so it can't fire against
    // the newly loaded note (or with the previous day's closure state). The
    // guard on prevDateStrRef keeps refetches of the same day from wiping a
    // debounce that is still in flight.
    if (prevDateStrRef.current !== dateStr) {
      prevDateStrRef.current = dateStr;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    }
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

  // Clear any pending autosave when the editor unmounts so a stale timer can't
  // fire after navigation away from the page.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

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
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const id = noteIdRef.current;
      if (id) {
        updateMutation.mutate({ id, data: { content: newContent, mood: newMood, energy: newEnergy } });
      } else if (newContent.trim()) {
        createMutation.mutate({ date: dateStr, content: newContent, mood: newMood, energy: newEnergy, ...(activeDomainId ? { domain: activeDomainId } : {}) });
      }
    }, 1500);
  }, [dateStr, activeDomainId, updateMutation, createMutation]);

  const handleContentChange = (value: string) => {
    setContent(value);
    autoSave(value, mood, energy);
  };

  const handleMoodChange = (value: number) => {
    setMood(value);
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: { mood: value } });
    } else if (isNew && !createMutation.isPending) {
      // No note exists for this day yet — create it so the mood is recorded
      // even before any content is typed.
      createMutation.mutate({ date: dateStr, content: content, mood: value, energy: energy, ...(activeDomainId ? { domain: activeDomainId } : {}) });
    }
  };

  const handleEnergyChange = (value: number) => {
    setEnergy(value);
    if (noteId) {
      updateMutation.mutate({ id: noteId, data: { energy: value } });
    } else if (isNew && !createMutation.isPending) {
      // No note exists for this day yet — create it so the energy is recorded
      // even before any content is typed.
      createMutation.mutate({ date: dateStr, content: content, mood: mood, energy: value, ...(activeDomainId ? { domain: activeDomainId } : {}) });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await api.delete("/daily-notes/" + id);
      } catch (error) {
        // The API responds 204 No Content, which has no JSON body, so api.delete
        // (which resolves res.json()) rejects with a SyntaxError on the empty
        // body even though the server-side delete succeeded. Re-throw anything
        // else (real HTTP/network failures).
        if (!(error instanceof SyntaxError)) throw error;
      }
    },
    onSuccess: () => {
      setContent("");
      setMood(null);
      setEnergy(null);
      setNoteId(null);
      setIsNew(true);
      queryClient.invalidateQueries({ queryKey: ["daily-note", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["daily-notes-list"] });
    },
  });

  const handleDelete = () => {
    if (noteId) deleteMutation.mutate(noteId);
  };

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-mono">{format(date, "EEE, MMM d, yyyy")}</h2>
        <div className="flex items-center gap-2">
          {noteId && (
            <>
              <Badge variant="secondary" className="text-[10px] font-mono">
                <Save className="h-3 w-3 mr-1" />Saved
              </Badge>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Delete daily note">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Daily Note</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete this daily note? This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Mood & Energy */}
      <div className="flex gap-5">
        <div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Mood</p>
          <div role="radiogroup" aria-label="Mood" className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={mood === v}
                aria-label={`Mood ${v}`}
                onClick={() => handleMoodChange(v)}
                className={cn(
                  "w-5 h-5 rounded text-[9px] font-mono font-medium transition-colors",
                  mood === v ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">Energy</p>
          <div role="radiogroup" aria-label="Energy" className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={energy === v}
                aria-label={`Energy ${v}`}
                onClick={() => handleEnergyChange(v)}
                className={cn(
                  "w-5 h-5 rounded text-[9px] font-mono font-medium transition-colors",
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
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">Loading...</div>
      ) : isNew && !content ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-muted-foreground text-sm">No note for this day</p>
          {tasksDue.length > 0 && <p className="text-[10px] font-mono text-muted-foreground">{tasksDue.length} tasks due · {habitsToday.length} habits</p>}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => textareaRef.current?.focus()}>
              <Plus className="h-3 w-3 mr-1" />Start Writing
            </Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={insertTemplate}>Insert Daily Template</Button>
          </div>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Write your daily note here..."
          className="w-full min-h-[280px] bg-transparent border-none outline-none resize-none text-sm font-mono leading-relaxed placeholder:text-muted-foreground/50"
        />
      )}
    </div>
  );
}

// ─── Daily Notes Page ────────────────────────────────────────────────────

function DailyNotesPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="flex flex-col md:flex-row gap-4 h-auto md:h-[calc(100vh-5rem)]">
      <CalendarSidebar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      <Separator className="hidden md:block" orientation="vertical" />
      <ScrollArea className="flex-1 md:pr-3 min-h-[60vh] md:min-h-0">
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
