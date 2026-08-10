import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, useApiQuery } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { Tag, PaginatedResponse } from "@/lib/types";

const ENTITY_ROUTES: Record<"task" | "habit" | "note", string> = {
  task: "tasks",
  habit: "habits",
  note: "notes",
};

interface TagManagerProps {
  entityType: "task" | "habit" | "note";
  entityId: string;
  tags: Tag[];
}

/**
 * Assign/remove tags on an entity from its detail page. The entity's tags come
 * from the parent's query data; mutations hit the tag junction endpoints and
 * refetch the entity so badges stay in sync with the API.
 */
export function TagManager({ entityType, entityId, tags }: TagManagerProps) {
  const queryClient = useQueryClient();
  const [addValue, setAddValue] = useState("");
  const plural = ENTITY_ROUTES[entityType];

  // Always fetch fresh so tags created elsewhere show up in the add dropdown.
  const { data: tagsData } = useApiQuery<PaginatedResponse<Tag>>(
    ["tags"],
    "/tags?perPage=100&sort=name",
    { staleTime: 0 }
  );
  const allTags = tagsData?.items || [];

  const assignedIds = new Set(tags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !assignedIds.has(t.id));

  const refreshEntity = () => {
    queryClient.invalidateQueries({ queryKey: [entityType, entityId] });
  };

  const assignMutation = useMutation({
    mutationFn: (tagId: string) => api.post(`/${plural}/${entityId}/tags`, { tagId }),
    onSuccess: refreshEntity,
  });

  const removeMutation = useMutation({
    mutationFn: (tagId: string) => api.delete(`/${plural}/${entityId}/tags/${tagId}`),
    onSuccess: refreshEntity,
  });

  const handleAssign = (tagId: string) => {
    if (!tagId || assignedIds.has(tagId)) return;
    setAddValue("");
    assignMutation.mutate(tagId);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {tags.length === 0 && (
          <span className="text-sm text-muted-foreground">No tags</span>
        )}
        {tags.map((t) => (
          <Badge key={t.id} variant="secondary" style={t.color ? { borderColor: t.color } : undefined}>
            {t.name}
            <button
              type="button"
              onClick={() => removeMutation.mutate(t.id)}
              disabled={removeMutation.isPending}
              aria-label={"Remove tag " + t.name}
              className="ml-1.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Select value={addValue} onValueChange={handleAssign} disabled={availableTags.length === 0}>
        <SelectTrigger className="h-8 w-64 text-xs" aria-label="Add tag">
          <SelectValue placeholder={availableTags.length === 0 ? "No more tags to add" : "Add tag..."} />
        </SelectTrigger>
        <SelectContent>
          {availableTags.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
