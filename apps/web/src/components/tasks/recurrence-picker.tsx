import { useMemo, useState } from "react";
import { RRule } from "rrule";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { value: "", label: "No repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", label: "Weekdays" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=WEEKLY;BYDAY=MO", label: "Weekly on Monday" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

export function RecurrencePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [preset, setPreset] = useState(value || "");
  const preview = useMemo(() => {
    if (!preset) return [];
    try {
      const rule = RRule.fromString(preset);
      const opts = { ...rule.options, dtstart: new Date() };
      const r = new RRule(opts);
      return r.all((_, i) => i < 5).map(d => d.toLocaleDateString());
    } catch { return []; }
  }, [preset]);

  return (
    <div className="space-y-2">
      <Label>Repeat</Label>
      <Select value={preset} onValueChange={(v) => { setPreset(v); onChange(v || null); }}>
        <SelectTrigger><SelectValue placeholder="No repeat" /></SelectTrigger>
        <SelectContent>
          {PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {preview.length > 0 && (
        <p className="text-xs text-muted-foreground">Next: {preview.join(" · ")}</p>
      )}
    </div>
  );
}
