import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { parseTaskInput } from "@/lib/nlp";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EntityType = "task" | "note" | "event";

const TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "note", label: "Note" },
  { value: "event", label: "Event" },
];

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("task");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputValue("");
      setEntityType("task");
    }
  }, [open]);

  const parsed = entityType === "task" ? parseTaskInput(inputValue) : null;

  const handleSubmit = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let createdId: string | null = null;

      if (entityType === "task") {
        const p = parseTaskInput(inputValue);
        const data: any = {
          title: p.title,
          priority: p.priority || "medium",
        };
        if (p.dueDate) data.dueDate = p.dueDate;
        if (p.tags.length) data.tagNames = p.tags;
        if (activeDomainId) data.domain = activeDomainId;
        const res = await api.post<{ id: string }>("/tasks", data);
        createdId = res.id;
        toast.success("Task created", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api.delete("/tasks/" + createdId);
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Task deleted");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      } else if (entityType === "note") {
        const res = await api.post<{ id: string }>("/notes", {
          title: inputValue.trim(),
          ...(activeDomainId ? { domain: activeDomainId } : {}),
        });
        createdId = res.id;
        toast.success("Note created", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api.delete("/notes/" + createdId);
                queryClient.invalidateQueries({ queryKey: ["notes"] });
                toast.success("Note deleted");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
        queryClient.invalidateQueries({ queryKey: ["notes"] });
      } else {
        const now = new Date();
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        const res = await api.post<{ id: string }>("/calendar/events", {
          title: inputValue.trim(),
          startTime: now.toISOString(),
          endTime: end.toISOString(),
          ...(activeDomainId ? { domain: activeDomainId } : {}),
        });
        createdId = res.id;
        toast.success("Event created", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await api.delete("/calendar/events/" + createdId);
                queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
                toast.success("Event deleted");
              } catch {
                toast.error("Failed to undo");
              }
            },
          },
        });
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      }

      setInputValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Capture</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEntityType(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  entityType === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              entityType === "task"
                ? 'Try "Buy milk tomorrow 5pm #groceries p1"'
                : entityType === "note"
                ? "Note title..."
                : "Event title..."
            }
            disabled={isSubmitting}
          />
          {entityType === "task" && parsed && (parsed.dueDate || parsed.priority || parsed.tags.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {parsed.dueDate && (
                <Badge variant="outline" className="text-[10px]">
                  Due {new Date(parsed.dueDate).toLocaleDateString()}{" "}
                  {new Date(parsed.dueDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Badge>
              )}
              {parsed.priority && (
                <Badge variant="secondary" className="text-[10px]">
                  Priority {parsed.priority}
                </Badge>
              )}
              {parsed.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">
                  #{t}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isSubmitting}
              size="sm"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
