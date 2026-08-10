import {
  CheckCircle2,
  CirclePlus,
  Dot,
  Link2,
  ListOrdered,
  MessageSquare,
  Pencil,
  Tag,
  Trash2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/state";
import { useApiQuery } from "@/lib/api";
import type { ActivityItem } from "@/lib/types";

interface EntityActivityProps {
  entityType: string;
  entityId: string;
  limit?: number;
}

interface ActivityResponse {
  items: ActivityItem[];
  totalItems: number;
}

interface ActionMeta {
  icon: LucideIcon;
  label: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  created: { icon: CirclePlus, label: "created" },
  completed: { icon: CheckCircle2, label: "completed" },
  updated: { icon: Pencil, label: "updated" },
  commented: { icon: MessageSquare, label: "commented" },
  tagged: { icon: Tag, label: "tagged" },
  untagged: { icon: Tag, label: "untagged" },
  reordered: { icon: ListOrdered, label: "reordered" },
  dependency_added: { icon: Link2, label: "added a dependency" },
  dependency_removed: { icon: Unlink, label: "removed a dependency" },
  deleted: { icon: Trash2, label: "deleted" },
  deleted_comment: { icon: Trash2, label: "deleted a comment" },
};

// Keys recorded alongside "updated" that aren't user-facing field changes.
const UPDATED_META_KEYS = new Set(["updatedAt", "createdAt", "previousStatus"]);

/** Compact, plain-text summary of what changed. Only meaningful for updates. */
function changesSummary(
  action: string,
  changes: Record<string, unknown> | null
): string | null {
  if (action !== "updated" || !changes) return null;
  const fields = Object.keys(changes).filter((key) => !UPDATED_META_KEYS.has(key));
  return fields.length > 0 ? fields.join(", ") : null;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta: ActionMeta = ACTION_META[item.action] ?? { icon: Dot, label: item.action };
  const Icon = meta.icon;
  const summary = changesSummary(item.action, item.changes);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{item.actor}</span>
          <span className="text-sm text-muted-foreground">{meta.label}</span>
          <span className="text-xs text-muted-foreground/70">
            {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
          </span>
        </p>
        {summary ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</p> : null}
      </div>
    </div>
  );
}

/**
 * Activity feed for a single entity. The API returns newest-first, so rows are
 * rendered in the order received. `limit` caps how many entries are fetched
 * (the API clamps it to 1–200).
 */
export function EntityActivity({ entityType, entityId, limit }: EntityActivityProps) {
  const path =
    `/activity?entityType=${entityType}&entityId=${entityId}` +
    (limit ? `&limit=${limit}` : "");

  const { data, isLoading, isError, error, refetch } = useApiQuery<ActivityResponse>(
    ["activity", entityType, entityId],
    path
  );

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <LoadingState label="Loading activity..." /> : null}
        {isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : "Failed to load activity"}
            onRetry={() => refetch()}
          />
        ) : null}
        {!isLoading && !isError && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet</p>
        ) : null}
        {!isLoading && !isError && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
