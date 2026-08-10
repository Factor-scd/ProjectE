import { useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import type { CustomField } from "@/lib/types";

interface CustomFieldsDisplayProps {
  /**
   * Plural entity type used by the custom-fields API, e.g. "tasks" | "habits".
   */
  entityType: string;
  values?: Record<string, unknown>;
}

/**
 * Read-only list of an entity's custom field values. Uses the field
 * definitions for labels and type-aware formatting when they are available;
 * falls back to raw `name: value` rendering otherwise. Skips empty values and
 * renders nothing when there is nothing to show.
 */
export function CustomFieldsDisplay({ entityType, values }: CustomFieldsDisplayProps) {
  const activeDomainId = useApiDomain();
  const { data } = useApiQuery<{ items: CustomField[]; totalItems: number }>(
    ["custom-fields", entityType, activeDomainId],
    "/custom-fields?entity=" + encodeURIComponent(entityType) + (activeDomainId ? "&domain=" + activeDomainId : "")
  );

  if (!values) return null;

  const defs = new Map((data?.items ?? []).map((f) => [f.name, f]));
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
  );
  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Custom Fields</h3>
      <div className="space-y-2">
        {entries.map(([name, value]) => {
          const field = defs.get(name);
          return (
            <div key={name} className="flex items-start gap-2 text-sm">
              <span className="w-40 shrink-0 text-muted-foreground">{field?.name ?? name}</span>
              <span className="flex-1 min-w-0 break-words">{formatValue(field, value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatValue(field: CustomField | undefined, value: unknown): string {
  if (field) {
    if (field.type === "boolean") return value ? "Yes" : "No";
    if (field.type === "date" && typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value.slice(0, 10) : d.toLocaleDateString();
    }
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
