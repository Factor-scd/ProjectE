export interface ParsedTaskInput {
  title: string;
  dueDate: string | null;
  priority: "low" | "medium" | "high" | "urgent" | null;
  tags: string[];
}

const PRIORITY_MAP: Record<string, ParsedTaskInput["priority"]> = {
  p1: "urgent",
  p2: "high",
  p3: "medium",
  p4: "low",
  urgent: "urgent",
  high: "high",
  medium: "medium",
  low: "low",
};

function parseDueDate(input: string): { date: Date | null; matched: string | null } {
  const lower = input.toLowerCase();
  const now = new Date();
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  let matched: string | null = null;
  let date: Date | null = null;

  const tryTime = (s: string): { hours: number; minutes: number; rest: string } | null => {
    const m = s.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2] || "0", 10);
    const ap = m[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { hours: h, minutes: min, rest: m[0] };
  };

  const applyTime = (d: Date, raw: string) => {
    const t = tryTime(raw);
    if (t) {
      d.setHours(t.hours, t.minutes, 0, 0);
      if (!matched) matched = raw.trim();
      else matched += " " + t.rest;
    } else {
      d.setHours(9, 0, 0, 0);
    }
  };

  if (lower.includes("today")) {
    date = new Date(base);
    matched = "today";
    const idx = lower.indexOf("today");
    applyTime(date, lower.slice(idx + 5, idx + 20));
  } else if (lower.includes("tomorrow")) {
    date = new Date(base);
    date.setDate(date.getDate() + 1);
    matched = "tomorrow";
    const idx = lower.indexOf("tomorrow");
    applyTime(date, lower.slice(idx + 8, idx + 25));
  } else if (lower.includes("yesterday")) {
    date = new Date(base);
    date.setDate(date.getDate() - 1);
    matched = "yesterday";
  } else if (/in\s+(\d+)\s+days?/i.test(lower)) {
    const m = lower.match(/in\s+(\d+)\s+days?/i)!;
    date = new Date(base);
    date.setDate(date.getDate() + parseInt(m[1], 10));
    matched = m[0];
  } else if (/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
    const m = lower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)!;
    const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const target = days[m[1].toLowerCase()];
    date = new Date(base);
    const cur = date.getDay();
    let diff = (target - cur + 7) % 7;
    if (diff === 0) diff = 7;
    date.setDate(date.getDate() + diff);
    matched = m[0];
  } else if (/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(lower)) {
    const m = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)!;
    const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const target = days[m[1].toLowerCase()];
    date = new Date(base);
    const cur = date.getDay();
    let diff = (target - cur + 7) % 7;
    if (diff === 0) diff = 7;
    date.setDate(date.getDate() + diff);
    matched = m[0];
  }

  if (date && !matched?.includes("at") && !matched?.includes(":")) {
    const t = tryTime(lower);
    if (t && t.hours !== 9) {
      date.setHours(t.hours, t.minutes, 0, 0);
      matched = (matched || "") + " " + t.rest;
    }
  }

  return { date, matched: matched?.trim() || null };
}

export function parseTaskInput(raw: string): ParsedTaskInput {
  let title = raw;

  const tags: string[] = [];
  const tagRegex = /#(\w[\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(raw)) !== null) tags.push(m[1].toLowerCase());
  title = title.replace(tagRegex, "").trim();

  let priority: ParsedTaskInput["priority"] = null;
  const prioRegex = /\b(p[1-4]|urgent|high|medium|low)\b/i;
  const prioMatch = raw.match(prioRegex);
  if (prioMatch) {
    const key = prioMatch[1].toLowerCase();
    priority = PRIORITY_MAP[key] || null;
    title = title.replace(prioMatch[0], "").trim();
  }

  const due = parseDueDate(raw);
  if (due.date) {
    const esc = due.matched!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(esc, "i"), "").trim();
    title = title.replace(/\b(at\s+\d{1,2}(:\d{2})?\s*(am|pm)?)\b/i, "").trim();
    title = title.replace(/\bat\b$/i, "").trim();
  }

  title = title.replace(/\s{2,}/g, " ").trim();
  if (!title) title = raw.replace(tagRegex, "").replace(prioRegex, "").trim() || raw;

  return { title: title || raw, dueDate: due.date ? due.date.toISOString() : null, priority, tags };
}
