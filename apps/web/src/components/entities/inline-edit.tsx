import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronsUpDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format as formatDate, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Failed to save";
}

interface InlineEditProps<T> {
  value: T;
  onSave: (value: T) => void | Promise<void>;
  display: (value: T) => ReactNode;
  renderEdit: (
    value: T,
    onChange: (v: T) => void,
    commit: (value?: T) => void,
    cancel: () => void
  ) => ReactNode;
  className?: string;
  title?: string;
  /** Show the subtle pencil affordance on hover. Disable when a custom icon is used. */
  showEditIcon?: boolean;
}

/**
 * Click-to-edit primitive. Renders `display(value)` normally; clicking swaps to
 * `renderEdit(...)` with autofocus. `commit()` calls `onSave` and exits edit
 * mode; on failure it toasts the error and reverts local state to the original
 * value. Esc cancels, blur (when not triggered by Enter) commits. While not
 * editing, external changes to `value` (realtime events, cache rollbacks from
 * failed mutations) are mirrored into the local draft immediately.
 */
export function InlineEdit<T>({
  value,
  onSave,
  display,
  renderEdit,
  className,
  title,
  showEditIcon = true,
}: InlineEditProps<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const originalRef = useRef(value);
  const committingRef = useRef(false);

  // Mirror external updates (realtime, cache rollbacks) into the draft while
  // not editing so the next edit session starts from the freshest value.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEdit = () => {
    originalRef.current = value;
    setDraft(value);
    setEditing(true);
  };

  const cancel = useCallback(() => {
    setDraft(originalRef.current);
    setEditing(false);
  }, []);

  const commit = useCallback(
    async (nextValue?: T) => {
      if (committingRef.current) return;
      committingRef.current = true;
      setEditing(false);
      try {
        await onSave(nextValue !== undefined ? nextValue : draft);
      } catch (err) {
        toast.error(errorMessage(err) || "Failed to save");
        setDraft(originalRef.current);
      } finally {
        committingRef.current = false;
      }
    },
    [draft, onSave]
  );

  const onChange = useCallback((v: T) => setDraft(v), []);

  if (editing) {
    return (
      <div className={cn("inline-flex max-w-full", className)}>
        {renderEdit(draft, onChange, commit, cancel)}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title={title}
      className={cn(
        "group inline-flex max-w-full cursor-pointer items-center gap-1 text-left",
        "rounded px-1 -mx-1 transition-colors hover:bg-muted/60",
        className
      )}
    >
      {display(value)}
      {showEditIcon && (
        <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

interface InlineTextProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  /** When false (default), an empty commit is treated as a cancel. */
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  title?: string;
}

/** Single-line text field. Enter commits, Esc cancels, blur commits. */
export function InlineText({
  value,
  onSave,
  allowEmpty = false,
  placeholder,
  className,
  title,
}: InlineTextProps) {
  return (
    <InlineEdit
      value={value}
      onSave={(next: string) => {
        const trimmed = next.trim();
        if (!trimmed && !allowEmpty) return;
        return onSave(trimmed);
      }}
      className={className}
      title={title}
      display={(v) =>
        v ? (
          <span>{v}</span>
        ) : (
          <span className="text-muted-foreground/70">{placeholder ?? "Click to edit"}</span>
        )
      }
      renderEdit={(v, onChange, commit, cancel) => (
        <Input
          value={v}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          onBlur={() => commit()}
          placeholder={placeholder}
          autoFocus
          className="h-7 w-full min-w-[8rem] px-2 text-sm"
        />
      )}
    />
  );
}

interface InlineTextareaProps {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  title?: string;
}

/** Multi-line field. Blur commits, Esc cancels. Rows auto-resize with content (min 3). */
export function InlineTextarea({
  value,
  onSave,
  placeholder,
  className,
  title,
}: InlineTextareaProps) {
  const rowsFor = (text: string) => Math.max(3, Math.ceil(text.length / 40));
  return (
    <InlineEdit
      value={value}
      onSave={onSave}
      className={className}
      title={title}
      display={(v) =>
        v ? (
          <span className="whitespace-pre-wrap">{v}</span>
        ) : (
          <span className="text-muted-foreground/70">{placeholder ?? "Click to edit"}</span>
        )
      }
      renderEdit={(v, onChange, commit, cancel) => (
        <Textarea
          value={v}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          placeholder={placeholder}
          autoFocus
          rows={rowsFor(v)}
          className="w-full text-sm"
        />
      )}
    />
  );
}

export interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectProps {
  value: string;
  options: InlineSelectOption[];
  onSave: (value: string) => void | Promise<void>;
  /** Custom display for the selected value; when provided a ChevronsUpDown icon is shown. */
  displayValue?: (value: string) => ReactNode;
  className?: string;
  title?: string;
}

/** Inline select. Selecting an option commits immediately. */
export function InlineSelect({
  value,
  options,
  onSave,
  displayValue,
  className,
  title,
}: InlineSelectProps) {
  return (
    <InlineEdit
      value={value}
      onSave={onSave}
      className={className}
      title={title}
      showEditIcon={false}
      display={(v) => (
        <span className="inline-flex items-center gap-1">
          <span>
            {displayValue
              ? displayValue(v)
              : options.find((o) => o.value === v)?.label ?? v}
          </span>
          {displayValue && (
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          )}
        </span>
      )}
      renderEdit={(v, onChange, commit, cancel) => (
        <InlineSelectControl
          value={v}
          options={options}
          onChange={onChange}
          commit={commit}
          cancel={cancel}
        />
      )}
    />
  );
}

function InlineSelectControl({
  value,
  options,
  onChange,
  commit,
  cancel,
}: {
  value: string;
  options: InlineSelectOption[];
  onChange: (v: string) => void;
  commit: (value?: string) => void;
  cancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Select
      value={value}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) cancel();
      }}
      onValueChange={(next) => {
        onChange(next);
        commit(next);
      }}
    >
      <SelectTrigger autoFocus className="h-7 w-full min-w-[8rem] text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface InlineDateProps {
  value: string | null;
  onSave: (value: string | null) => void | Promise<void>;
  /** date-fns format string used for display. Defaults to "MMM d, yyyy". */
  format?: string;
  placeholder?: string;
  className?: string;
  title?: string;
}

/** Date field. Changing the value commits immediately; clearing saves null. */
export function InlineDate({
  value,
  onSave,
  format: formatStr = "MMM d, yyyy",
  placeholder = "No date",
  className,
  title,
}: InlineDateProps) {
  return (
    <InlineEdit
      value={value}
      onSave={onSave}
      className={className}
      title={title}
      display={(v) =>
        v ? (
          <span>{formatDate(parseISO(v), formatStr)}</span>
        ) : (
          <span className="text-muted-foreground/70">{placeholder}</span>
        )
      }
      renderEdit={(v, onChange, commit, cancel) => (
        <Input
          type="date"
          value={v ?? ""}
          onChange={(e) => {
            const next = e.target.value ? e.target.value : null;
            onChange(next);
            commit(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          autoFocus
          className="h-7 w-fit text-sm"
        />
      )}
    />
  );
}

interface InlineToggleProps {
  checked: boolean;
  onSave: (checked: boolean) => void | Promise<void>;
  label?: string;
  className?: string;
}

/** Toggle switch. Commits immediately on change. */
export function InlineToggle({ checked, onSave, label, className }: InlineToggleProps) {
  const [pending, setPending] = useState(false);

  const handleChange = async (next: boolean) => {
    if (pending) return;
    setPending(true);
    try {
      await onSave(next);
    } catch (err) {
      toast.error(errorMessage(err) || "Failed to save");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Switch checked={checked} onCheckedChange={handleChange} disabled={pending} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}
