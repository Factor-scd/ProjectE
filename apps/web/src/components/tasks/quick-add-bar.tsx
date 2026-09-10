import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { parseTaskInput } from "@/lib/nlp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task } from "@/lib/types";

interface QuickAddBarProps {
  projectId?: string | null;
  sectionId?: string | null;
  onMoreOptions?: () => void;
  onCreated?: (task: Task) => void;
  placeholder?: string;
}

/**
 * Linear-style quick-add: type a title, press Enter, the task appears.
 * Natural-language parsing (due dates, priorities, tags) runs live.
 */
export function QuickAddBar({ projectId, sectionId, onMoreOptions, onCreated, placeholder }: QuickAddBarProps) {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const [title, setTitle] = useState("");
  const parsed = title.trim() ? parseTaskInput(title) : null;

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Task>("/tasks", data),
    onSuccess: (task) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task-groups"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      onCreated?.(task);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create task"),
  });

  const submit = () => {
    const raw = title.trim();
    if (!raw || createMutation.isPending) return;
    const p = parseTaskInput(raw);
    createMutation.mutate({
      title: p.title,
      priority: p.priority || "medium",
      ...(p.dueDate ? { dueDate: p.dueDate } : {}),
      ...(p.tags.length > 0 ? { tagNames: p.tags } : {}),
      ...(projectId ? { projectId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(activeDomainId ? { domain: activeDomainId } : {}),
    });
  };

  return (
    <div className="rounded-lg border border-[#d9dee7] bg-white shadow-[0_1px_2px_#fafafa]">
      <div className="flex items-center gap-2 px-3 py-2">
        <Plus className="h-4 w-4 shrink-0 text-[#1677ff]" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder || 'Add a task — try "Report due tomorrow 5pm #work p1"'}
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          aria-label="Quick add task"
        />
        {onMoreOptions && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onMoreOptions} title="More options" aria-label="More task options">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
        <Button size="sm" className="h-7 shrink-0" disabled={!title.trim() || createMutation.isPending} onClick={submit}>
          Add
        </Button>
      </div>
      {parsed && (parsed.dueDate || parsed.priority || parsed.tags.length > 0) && (
        <div className="flex flex-wrap gap-1 border-t border-[#f1f1f1] px-3 py-1.5">
          {parsed.dueDate && (
            <Badge variant="outline" className="border-[#91caff] bg-[#e6f4ff] text-[10px] text-[#002c8c]">
              Due {new Date(parsed.dueDate).toLocaleDateString()}{" "}
              {new Date(parsed.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          )}
          {parsed.priority && <Badge variant="secondary" className="text-[10px]">Priority {parsed.priority}</Badge>}
          {parsed.tags.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
