import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, useApiMutation } from "@/lib/api";
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationRule,
  AutomationTriggerType,
  Project,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// ── Shared metadata (also used by the Automations tab for summaries) ───────────

export const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string }[] = [
  { value: "task_status_changed", label: "Task status changed" },
  { value: "task_created", label: "Task created" },
  { value: "due_date_approaching", label: "Due date approaching" },
];

export const ACTION_OPTIONS: { value: AutomationActionType; label: string }[] = [
  { value: "set_status", label: "Set status" },
  { value: "set_priority", label: "Set priority" },
  { value: "add_label", label: "Add label" },
  { value: "create_notification", label: "Send notification" },
];

export const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CONDITION_FIELD_OPTIONS: { value: AutomationConditionField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "label", label: "Label" },
];

const STATUS_OPS: { value: string; label: string }[] = [
  { value: "to", label: "changes to" },
  { value: "from", label: "changes from" },
  { value: "eq", label: "is" },
];

const PRIORITY_OPS: { value: string; label: string }[] = [
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
];

const LABEL_OPS: { value: string; label: string }[] = [
  { value: "has", label: "has" },
  { value: "not_has", label: "does not have" },
];

function opsForField(field: AutomationConditionField): { value: string; label: string }[] {
  switch (field) {
    case "status":
      return STATUS_OPS;
    case "priority":
      return PRIORITY_OPS;
    case "label":
      return LABEL_OPS;
    default:
      return STATUS_OPS;
  }
}

function statusLabel(project: Project, key: string): string {
  return project.statuses?.find((s) => s.key === key)?.label ?? key;
}

function summarizeActions(project: Project, actions: AutomationAction[]): string[] {
  return actions.map((action) => {
    const params = action.params ?? {};
    switch (action.type) {
      case "set_status":
        return `Set status to ${statusLabel(project, String(params.statusKey ?? ""))}`;
      case "set_priority":
        return `Set priority to ${String(params.priority ?? "")}`;
      case "add_label":
        return `Add label "${String(params.label ?? "")}"`;
      case "create_notification":
        return `Notify: ${String(params.message ?? "")}`;
      default:
        return action.type;
    }
  });
}

export { summarizeActions };

// ── Rule builder dialog ─────────────────────────────────────────────────────────

interface DraftCondition {
  field: AutomationConditionField;
  op: string;
  value: string;
}

interface DraftAction {
  type: AutomationActionType;
  params: Record<string, string>;
}

interface RuleBuilderProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this rule instead of creating a new one. */
  rule?: AutomationRule | null;
  onSaved?: () => void;
}

function toDraftConditions(conditions: AutomationCondition[]): DraftCondition[] {
  return conditions.map((c) => ({
    field: c.field,
    op: c.op,
    value: typeof c.value === "string" ? c.value : String(c.value ?? ""),
  }));
}

function toDraftActions(actions: AutomationAction[]): DraftAction[] {
  return actions.map((a) => {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(a.params ?? {})) {
      params[key] = typeof value === "string" ? value : String(value ?? "");
    }
    return { type: a.type, params };
  });
}

export function AutomationRuleBuilder({
  project,
  open,
  onOpenChange,
  rule = null,
  onSaved,
}: RuleBuilderProps) {
  const [name, setName] = useState(rule?.name ?? "");
  const [active, setActive] = useState(rule?.active ?? true);
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    rule?.trigger.type ?? "task_status_changed"
  );
  const [conditions, setConditions] = useState<DraftCondition[]>(
    toDraftConditions(rule?.conditions ?? [])
  );
  const [actions, setActions] = useState<DraftAction[]>(
    toDraftActions(rule?.actions ?? [])
  );

  const createMutation = useApiMutation<AutomationRule, Record<string, unknown>>(
    "post",
    `/projects/${project.id}/automations`
  );
  const updateMutation = useApiMutation<AutomationRule, Record<string, unknown>>(
    "patch",
    `/projects/${project.id}/automations/${rule?.id}`
  );

  const isEditing = Boolean(rule?.id);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const updateAction = (index: number, patch: Partial<DraftAction>) => {
    setActions((prev) =>
      prev.map((a, i) => (i === index ? { ...a, ...patch } : a))
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    if (actions.length === 0) {
      toast.error("Add at least one action");
      return;
    }

    // Drop condition rows whose value is still empty.
    const validConditions = conditions.filter(
      (c) => typeof c.value === "string" && c.value.trim() !== ""
    );

    const payload: Record<string, unknown> = {
      name: name.trim(),
      active,
      trigger: { type: triggerType },
      conditions: validConditions.map((c) => ({ field: c.field, op: c.op, value: c.value })),
      actions: actions.map((a) => ({ type: a.type, params: a.params })),
    };

    const onSuccess = () => {
      toast.success(isEditing ? "Rule updated" : "Rule created");
      onSaved?.();
      onOpenChange(false);
    };
    const onError = (err: Error) => toast.error(err.message);

    if (isEditing) {
      updateMutation.mutate(payload, { onSuccess, onError });
    } else {
      createMutation.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit automation rule" : "Create automation rule"}</DialogTitle>
          <DialogDescription>
            When something happens to a task, automatically run actions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ship completed tasks"
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch
                checked={active}
                onCheckedChange={setActive}
                aria-label="Rule active"
              />
              <Label htmlFor="rule-active" className="cursor-pointer">
                {active ? "Active" : "Inactive"}
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>When</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as AutomationTriggerType)}>
              <SelectTrigger aria-label="Trigger" className="w-full">
                <SelectValue placeholder="Select a trigger" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setConditions((prev) => [
                    ...prev,
                    { field: "status", op: "to", value: project.statuses?.[0]?.key ?? "" },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add condition
              </Button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No conditions — the rule fires on every matching event.
              </p>
            ) : (
              conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(v) => {
                      const field = v as AutomationConditionField;
                      updateCondition(index, {
                        field,
                        op: opsForField(field)[0]?.value ?? "eq",
                        value: "",
                      });
                    }}
                  >
                    <SelectTrigger aria-label="Condition field" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.op}
                    onValueChange={(v) => updateCondition(index, { op: v })}
                  >
                    <SelectTrigger aria-label="Condition operator" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {opsForField(condition.field).map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {condition.field === "status" ? (
                    <Select
                      value={condition.value}
                      onValueChange={(v) => updateCondition(index, { value: v })}
                    >
                      <SelectTrigger aria-label="Status" className="min-w-0 flex-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {(project.statuses ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : condition.field === "priority" ? (
                    <Select
                      value={condition.value}
                      onValueChange={(v) => updateCondition(index, { value: v })}
                    >
                      <SelectTrigger aria-label="Priority" className="min-w-0 flex-1">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      placeholder="Label name"
                      className="min-w-0 flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setConditions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove condition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setActions((prev) => [
                    ...prev,
                    { type: "set_status", params: { statusKey: project.statuses?.[0]?.key ?? "" } },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add action
              </Button>
            </div>
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No actions — add at least one.</p>
            ) : (
              actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(v) => {
                      const type = v as AutomationActionType;
                      const defaults: Record<AutomationActionType, Record<string, string>> = {
                        set_status: { statusKey: project.statuses?.[0]?.key ?? "" },
                        set_priority: { priority: "medium" },
                        add_label: { label: "" },
                        create_notification: { message: "" },
                      };
                      updateAction(index, { type, params: defaults[type] });
                    }}
                  >
                    <SelectTrigger aria-label="Action type" className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {action.type === "set_status" ? (
                    <Select
                      value={action.params.statusKey ?? ""}
                      onValueChange={(v) =>
                        updateAction(index, { params: { ...action.params, statusKey: v } })
                      }
                    >
                      <SelectTrigger aria-label="Status" className="min-w-0 flex-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {(project.statuses ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : action.type === "set_priority" ? (
                    <Select
                      value={action.params.priority ?? ""}
                      onValueChange={(v) =>
                        updateAction(index, { params: { ...action.params, priority: v } })
                      }
                    >
                      <SelectTrigger aria-label="Priority" className="min-w-0 flex-1">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : action.type === "add_label" ? (
                    <Input
                      value={action.params.label ?? ""}
                      onChange={(e) =>
                        updateAction(index, { params: { ...action.params, label: e.target.value } })
                      }
                      placeholder="Label name"
                      className="min-w-0 flex-1"
                    />
                  ) : (
                    <Input
                      value={action.params.message ?? ""}
                      onChange={(e) =>
                        updateAction(index, { params: { ...action.params, message: e.target.value } })
                      }
                      placeholder="Notification message"
                      className="min-w-0 flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setActions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove action"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isEditing ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
