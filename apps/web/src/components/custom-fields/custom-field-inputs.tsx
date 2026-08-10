import { useEffect, useRef } from "react";
import { useApiQuery } from "@/lib/api";
import { useApiDomain } from "@/lib/stores/use-active-domain-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CustomField } from "@/lib/types";

export type CustomFieldsValue = Record<string, unknown>;

interface CustomFieldInputsProps {
  /**
   * Plural entity type used by the custom-fields API, e.g. "tasks" | "habits".
   */
  entityType: string;
  values: CustomFieldsValue;
  onChange: (values: CustomFieldsValue) => void;
}

/**
 * Renders a type-aware input for every custom field defined for an entity.
 * The entity payload carries values as `customFields: { [fieldName]: value }`,
 * which this component reads and writes via `values` / `onChange`.
 *
 * Renders nothing when no custom fields are defined for the entity.
 */
export function CustomFieldInputs({ entityType, values, onChange }: CustomFieldInputsProps) {
  const activeDomainId = useApiDomain();
  const { data } = useApiQuery<{ items: CustomField[]; totalItems: number }>(
    ["custom-fields", entityType, activeDomainId],
    "/custom-fields?entity=" + encodeURIComponent(entityType) + (activeDomainId ? "&domain=" + activeDomainId : "")
  );
  const fields = data?.items ?? [];

  // Keep the latest values in a ref so the default-seeding effect below never
  // clobbers edits the user makes while definitions refetch in the background.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Seed defaults for fields that have no value yet (e.g. a field created after
  // the task already existed, or a brand new task with field defaults).
  useEffect(() => {
    if (fields.length === 0) return;
    let changed = false;
    const next: CustomFieldsValue = { ...valuesRef.current };
    for (const field of fields) {
      if (next[field.name] === undefined && field.defaultValue !== null && field.defaultValue !== undefined) {
        next[field.name] = field.defaultValue;
        changed = true;
      }
    }
    if (changed) onChange(next);
    // `valuesRef.current` is intentionally read (not listed) so the effect only
    // runs when the field definitions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, onChange]);

  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <Separator />
      <div>
        <Label className="text-sm font-semibold text-muted-foreground">Custom Fields</Label>
        <div className="mt-3 space-y-4">
          {fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={values[field.name]}
              onValueChange={(name, value) => onChange({ ...values, [name]: value })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onValueChange,
}: {
  field: CustomField;
  value: unknown;
  onValueChange: (name: string, value: unknown) => void;
}) {
  const inputId = "cf-" + field.name;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={inputId} checked={Boolean(value)} onCheckedChange={(v) => onValueChange(field.name, v === true)} />
        <Label htmlFor={inputId} className="font-normal">{field.name}</Label>
      </div>
    );
  }

  if (field.type === "multi_select") {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <Label>{field.name}</Label>
        <div className="space-y-1.5">
          {(field.options ?? []).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={inputId + "-" + opt}
                checked={selected.includes(opt)}
                onCheckedChange={(v) => {
                  const next = v ? [...selected, opt] : selected.filter((o) => o !== opt);
                  onValueChange(field.name, next.length > 0 ? next : null);
                }}
              />
              <Label htmlFor={inputId + "-" + opt} className="font-normal">{opt}</Label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>
        {field.name}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {renderStandardControl(field, value, inputId, onValueChange)}
    </div>
  );
}

function renderStandardControl(
  field: CustomField,
  value: unknown,
  inputId: string,
  onValueChange: (name: string, value: unknown) => void
) {
  switch (field.type) {
    case "number": {
      let numeric: number | "" = "";
      if (typeof value === "number") numeric = value;
      else if (value !== undefined && value !== null) {
        const parsed = Number(value);
        numeric = Number.isNaN(parsed) ? "" : parsed;
      }
      return (
        <Input
          id={inputId}
          type="number"
          value={numeric}
          onChange={(e) => onValueChange(field.name, e.target.value === "" ? null : Number(e.target.value))}
          required={field.required}
        />
      );
    }
    case "date": {
      return (
        <Input
          id={inputId}
          type="date"
          value={value !== undefined && value !== null ? String(value).slice(0, 10) : ""}
          onChange={(e) => onValueChange(field.name, e.target.value || null)}
          required={field.required}
        />
      );
    }
    case "select": {
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => onValueChange(field.name, v || null)}
        >
          <SelectTrigger id={inputId}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    default: {
      return (
        <Input
          id={inputId}
          type="text"
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => onValueChange(field.name, e.target.value || null)}
          required={field.required}
        />
      );
    }
  }
}
