import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Calendar, Clock, Flag, FolderKanban, Tag as TagIcon, Repeat, CornerDownLeft } from "lucide-react";
import { api, useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { parseQuickAdd, type ParsedTask, type QuickAddContext } from "@/lib/nlp-parser";
import { PRIORITY } from "@/lib/status-colors";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project, Tag, StatusDefinition, PaginatedResponse } from "@/lib/types";

function PreviewChip({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal text-xs", className)}>
      {icon}
      {label}
    </Badge>
  );
}

export function QuickAddBar() {
  const queryClient = useQueryClient();
  const activeDomainId = useApiDomain();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  // Projects and tags in the active domain, used to resolve #proj / @tag tokens.
  const { data: projectsData } = useApiQuery<PaginatedResponse<Project>>(
    ["projects", activeDomainId],
    activeDomainId ? `/projects?limit=200&domain=${activeDomainId}` : "",
    { enabled: !!activeDomainId }
  );
  const { data: tagsData } = useApiQuery<PaginatedResponse<Tag>>(
    ["tags", activeDomainId],
    "/tags?perPage=200",
    { enabled: !!activeDomainId }
  );

  const projects = projectsData?.items ?? [];
  const tags = tagsData?.items ?? [];

  // Context for the parser: the set of known project/tag names.
  const context: QuickAddContext = useMemo(
    () => ({ projectNames: projects.map((p) => p.name), tagNames: tags.map((t) => t.name) }),
    [projects, tags]
  );

  const parsed = useMemo(() => parseQuickAdd(text, context), [text, context]);

  // Project statuses (to find the "todo" status when a project is selected).
  const resolvedProject = parsed.project
    ? projects.find((p) => p.name.toLowerCase() === parsed.project!.toLowerCase())
    : undefined;
  const { data: statusesData } = useApiQuery<{ items: StatusDefinition[] }>(
    ["project-statuses", resolvedProject?.id ?? "none"],
    resolvedProject ? `/projects/${resolvedProject.id}/statuses` : "",
    { enabled: !!resolvedProject }
  );
  const todoStatus = statusesData?.items?.find((s) => s.category === "todo");

  // Keyboard shortcut: `n` (no modifiers, outside editable fields) focuses the
  // bar. Mirrors the app's single-key shortcut pattern (?, /, c).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        e.metaKey || e.ctrlKey || e.altKey ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]')
      ) {
        return;
      }
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const canSubmit = parsed.title.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      // Resolve matched names back to ids for the API payload.
      const tagIds = parsed.tags
        ?.map((name) => tags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
        .filter((id): id is string => !!id);

      await api.post("/tasks", {
        title: parsed.title,
        ...(parsed.priority ? { priority: parsed.priority } : {}),
        ...(resolvedProject ? { projectId: resolvedProject.id } : {}),
        ...(parsed.dueDate ? { dueDate: parsed.dueDate.toISOString() } : {}),
        ...(parsed.recurrence ? { recurrenceRule: parsed.recurrence } : {}),
        ...(todoStatus ? { statusId: todoStatus.id } : {}),
        ...(tagIds && tagIds.length > 0 ? { tagIds } : {}),
        ...(activeDomainId ? { domain: activeDomainId } : {}),
      });

      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setText("");
      toast.success("Created!");
    } catch (err) {
      toast.error((err as Error).message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview chips describing what the parser detected.
  const chips: React.ReactNode[] = [];
  if (parsed.dueDate) {
    chips.push(
      <PreviewChip
        key="due"
        icon={<Calendar className="h-3 w-3" />}
        label={parsed.dueDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) + (parsed.dueDate.getHours() || parsed.dueDate.getMinutes()
          ? ` ${parsed.dueDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
          : "")}
      />
    );
  }
  if (parsed.priority) {
    chips.push(
      <PreviewChip
        key="prio"
        icon={<Flag className="h-3 w-3" />}
        label={PRIORITY[parsed.priority]?.label ?? parsed.priority}
        className="text-orange-500"
      />
    );
  }
  if (resolvedProject) {
    chips.push(
      <PreviewChip
        key="proj"
        icon={<FolderKanban className="h-3 w-3" />}
        label={resolvedProject.name}
        className="text-violet-500"
      />
    );
  }
  if (parsed.tags?.length) {
    for (const tag of parsed.tags) {
      chips.push(
        <PreviewChip
          key={`tag-${tag}`}
          icon={<TagIcon className="h-3 w-3" />}
          label={tag}
          className="text-sky-500"
        />
      );
    }
  }
  if (parsed.recurrence) {
    chips.push(
      <PreviewChip key="rec" icon={<Repeat className="h-3 w-3" />} label="Recurring" />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto w-full max-w-xl rounded-xl border bg-background/95 shadow-lg backdrop-blur"
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Quick add: 'buy milk tomorrow !high #work'"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Quick add task"
          />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-8 gap-1"
            disabled={!canSubmit}
          >
            Add
            <CornerDownLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
        {focused && (chips.length > 0 || text.trim().length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
            {chips.length > 0 ? (
              chips
            ) : (
              <span className="text-xs text-muted-foreground">
                <kbd className="rounded border bg-muted px-1">!high</kbd> priority ·{" "}
                <kbd className="rounded border bg-muted px-1">#project</kbd> ·{" "}
                <kbd className="rounded border bg-muted px-1">@tag</kbd> ·{" "}
                <kbd className="rounded border bg-muted px-1">tomorrow</kbd>
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
