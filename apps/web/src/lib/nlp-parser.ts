/**
 * Natural-language quick-add parser.
 *
 * A pure, dependency-light tokenizer that turns free-text task input into
 * structured task data:
 *
 *   "buy milk tomorrow !high #work @sarah every monday"
 *     → title: "buy milk", dueDate: tomorrow, priority: "high",
 *       project: "work" (resolved against context), tags: ["sarah"],
 *       recurrence: "FREQ=WEEKLY;BYDAY=MO"
 *
 * No network calls, no external NLP library — just regex tokenization over a
 * normalized token stream, evaluated in the browser's local timezone.
 */

export type QuickAddPriority = "low" | "medium" | "high" | "urgent";

export interface ParsedTask {
  /** The remaining free text with all recognized tokens removed. */
  title: string;
  /** Resolved absolute due date (local timezone), if one was given. */
  dueDate?: Date;
  priority?: QuickAddPriority;
  /**
   * The matched project NAME (from `#project`), when it matches a known name
   * in `context.projectNames`. The caller maps this name to an id before
   * sending the create request.
   */
  project?: string;
  /** Matched tag NAMES (from `@label`), when they match `context.tagNames`. */
  tags?: string[];
  /** An RFC 5545 RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO"). */
  recurrence?: string;
  /** The original, unmodified input string. */
  raw: string;
}

export interface QuickAddContext {
  projectNames?: string[];
  tagNames?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Strip leading zeros so "02" reads as "2" (used for ordinal date math). */
function num(n: string): number {
  return parseInt(n.replace(/^0+/, "") || "0", 10);
}

/** Start-of-day in the local timezone. All date tokens are anchored to this. */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

/** Next occurrence of `weekday` (0=Sun..6=Sat). When includeToday, today counts. */
function nextWeekday(from: Date, weekday: number, includeToday: boolean): Date {
  let d = startOfDay(from);
  if (!includeToday) d = addDays(d, 1);
  while (d.getDay() !== weekday) d = addDays(d, 1);
  return d;
}

// ── Tokenization ──────────────────────────────────────────────────────────────

type TokenKind =
  | "word"
  | "priority"
  | "project"
  | "tag"
  | "date"
  | "time"
  | "recurrence";

interface Token {
  kind: TokenKind;
  value: string;
}

/**
 * Break the input into a token stream, tagging each token with its kind.
 * Plain words are kept verbatim (the title is rebuilt from them in order).
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const re =
    /(\*\*)|(!urgent|!high|!medium|!low)|(#[^\s]+)|(@[^\s]+)|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)|([0-2]?\d:\d{2}\s?(?:am|pm)?)|([^\s]+)/gi;

  for (const m of input.matchAll(re)) {
    const full = m[0];
    if (!full) continue;

    if (/^!!$/.test(full)) {
      tokens.push({ kind: "priority", value: "urgent" });
    } else if (/^!(urgent|high|medium|low)$/i.test(full)) {
      tokens.push({ kind: "priority", value: full.slice(1).toLowerCase() });
    } else if (/^#[^\s]+$/.test(full)) {
      tokens.push({ kind: "project", value: full.slice(1) });
    } else if (/^@[^\s]+$/.test(full)) {
      tokens.push({ kind: "tag", value: full.slice(1) });
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(full) || /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(full)) {
      tokens.push({ kind: "date", value: full });
    } else if (/^[0-2]?\d:\d{2}\s?(?:am|pm)?$/i.test(full)) {
      tokens.push({ kind: "time", value: full });
    } else {
      tokens.push({ kind: "word", value: full });
    }
  }

  return tokens;
}

// ── Recurrence parsing ────────────────────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a recurrence phrase into an RRULE (RFC 5545), or null if the window
 * does not start with a recurrence. Returns the rule and how many words it
 * consumed.
 */
function parseRecurrence(words: string[]): { rrule: string; consumed: number } | null {
  const low = words.map((w) => w.toLowerCase());

  if (low[0] === "daily") return { rrule: "FREQ=DAILY", consumed: 1 };
  if (low[0] === "weekly") return { rrule: "FREQ=WEEKLY", consumed: 1 };
  if (low[0] === "monthly") return { rrule: "FREQ=MONTHLY", consumed: 1 };
  if (low[0] === "yearly") return { rrule: "FREQ=YEARLY", consumed: 1 };

  if (low[0] === "every") {
    let i = 1;
    let interval = 1;
    if (/^\d+$/.test(low[i] ?? "")) {
      interval = num(low[i]);
      i += 1;
    }

    // Omit INTERVAL when it's the default 1 to keep rules concise.
    const intervalPart = interval !== 1 ? `;INTERVAL=${interval}` : "";
    const unit = low[i];
    if (unit === "day" || unit === "days") return { rrule: `FREQ=DAILY${intervalPart}`, consumed: i + 1 };
    if (unit === "week" || unit === "weeks") return { rrule: `FREQ=WEEKLY${intervalPart}`, consumed: i + 1 };
    if (unit === "month" || unit === "months") {
      // "every month on the 15th"
      if (
        (low[i + 1] === "on" && low[i + 2] === "the" && /^(\d+)(st|nd|rd|th)?$/.test(low[i + 3] ?? ""))
      ) {
        const day = num(low[i + 3]);
        if (day >= 1 && day <= 31) {
          return { rrule: `FREQ=MONTHLY${intervalPart};BYMONTHDAY=${day}`, consumed: i + 4 };
        }
      }
      return { rrule: `FREQ=MONTHLY${intervalPart}`, consumed: i + 1 };
    }
    if (unit === "year" || unit === "years") return { rrule: `FREQ=YEARLY${intervalPart}`, consumed: i + 1 };

    if (WEEKDAY_MAP[unit] !== undefined) {
      const byday = unit.slice(0, 2).toUpperCase();
      return { rrule: `FREQ=WEEKLY${intervalPart};BYDAY=${byday}`, consumed: i + 1 };
    }

    return null;
  }

  return null;
}

// ── Date & time parsing ───────────────────────────────────────────────────────

/** Parse a single-word date token (ISO date or slash date). */
function parseSingleWordDate(word: string, now: Date): Date | null {
  const low = word.toLowerCase();

  const iso = low.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = num(iso[1]);
    const m = num(iso[2]) - 1;
    const d = num(iso[3]);
    const date = new Date(y, m, d, 0, 0, 0, 0);
    if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) {
      return date;
    }
    return null;
  }

  const slash = low.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const a = num(slash[1]);
    const b = num(slash[2]);
    if (slash[3]) {
      let y = num(slash[3]);
      if (y < 100) y += 2000;
      const date = new Date(y, a - 1, b, 0, 0, 0, 0);
      return isNaN(date.getTime()) ? null : date;
    }
    // MM/DD — next future occurrence
    let date = new Date(now.getFullYear(), a - 1, b, 0, 0, 0, 0);
    if (isNaN(date.getTime())) return null;
    if (date < startOfDay(now)) date = new Date(now.getFullYear() + 1, a - 1, b, 0, 0, 0, 0);
    return date;
  }

  return null;
}

/** Parse a "dec 25" phrase (month name + day). Consumes 2 words. */
function parseMonthDay(words: string[], now: Date): { date: Date; consumed: number } | null {
  const low = words.map((w) => w.toLowerCase());
  if (MONTH_MAP[low[0]] !== undefined && /^(\d{1,2})(st|nd|rd|th)?$/.test(low[1] ?? "")) {
    const day = num(low[1]);
    if (day < 1 || day > 31) return null;
    const month = MONTH_MAP[low[0]];
    let date = new Date(now.getFullYear(), month, day, 0, 0, 0, 0);
    if (isNaN(date.getTime())) return null;
    if (date < startOfDay(now)) date = new Date(now.getFullYear() + 1, month, day, 0, 0, 0, 0);
    return { date, consumed: 2 };
  }
  return null;
}

/**
 * Parse a multi-word date phrase ("tomorrow", "next friday", "in 3 days",
 * "end of month"). Returns the date plus how many words were consumed.
 */
function parseDatePhrase(
  words: string[],
  now: Date
): { date: Date; consumed: number } | null {
  const low = words.map((w) => w.toLowerCase());

  if (low[0] === "tomorrow") return { date: addDays(startOfDay(now), 1), consumed: 1 };
  if (low[0] === "today" || low[0] === "tonight") return { date: startOfDay(now), consumed: 1 };

  if (low[0] === "in" && /^\d+$/.test(low[1] ?? "")) {
    const n = num(low[1]);
    if (low[2] === "days" || low[2] === "day") return { date: addDays(startOfDay(now), n), consumed: 3 };
    if (low[2] === "weeks" || low[2] === "week") return { date: addDays(startOfDay(now), n * 7), consumed: 3 };
    if (low[2] === "months" || low[2] === "month") return { date: addMonths(startOfDay(now), n), consumed: 3 };
    if (low[2] === "hours" || low[2] === "hour") return { date: new Date(now.getTime() + n * 3600 * 1000), consumed: 3 };
  }

  if ((low[0] === "next" || low[0] === "this") && WEEKDAY_MAP[low[1] ?? ""] !== undefined) {
    return { date: nextWeekday(now, WEEKDAY_MAP[low[1]], low[0] === "this"), consumed: 2 };
  }

  if (low[0] === "next" && low[1] === "week") return { date: addDays(startOfDay(now), 7), consumed: 2 };
  if (low[0] === "next" && low[1] === "month") return { date: addMonths(startOfDay(now), 1), consumed: 2 };

  if (low[0] === "end" && low[1] === "of") {
    if (low[2] === "month") {
      const sod = startOfDay(now);
      return { date: new Date(sod.getFullYear(), sod.getMonth() + 1, 0), consumed: 3 };
    }
    if (low[2] === "week") return { date: nextWeekday(now, 6, false), consumed: 3 };
    if (low[2] === "day") return { date: startOfDay(now), consumed: 3 };
  }

  if (WEEKDAY_MAP[low[0]] !== undefined) {
    return { date: nextWeekday(now, WEEKDAY_MAP[low[0]], false), consumed: 1 };
  }

  return null;
}

/** Parse a time token ("2pm", "14:30", "9am") into hours/minutes. */
function parseTime(word: string): { hours: number; minutes: number } | null {
  const colon = word.toLowerCase().match(/^([0-2]?\d):(\d{2})\s?(am|pm)?$/);
  if (colon) {
    let h = num(colon[1]);
    const min = num(colon[2]);
    const ampm = colon[3];
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return { hours: h, minutes: min };
  }
  const bare = word.toLowerCase().match(/^(\d{1,2})(am|pm)$/);
  if (bare) {
    let h = num(bare[1]);
    if (bare[2] === "pm" && h < 12) h += 12;
    if (bare[2] === "am" && h === 12) h = 0;
    if (h > 23) return null;
    return { hours: h, minutes: 0 };
  }
  return null;
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a quick-add string into structured task data.
 *
 * `context` supplies the user's known project/tag names so `#proj` and `@tag`
 * tokens can be matched (the matched NAME is returned; the caller resolves it
 * to an id). Unknown tokens are left in the title so nothing is silently lost.
 */
export function parseQuickAdd(input: string, context?: QuickAddContext): ParsedTask {
  const tokens = tokenize(input);
  // Date.now() (rather than `new Date()`) so tests can pin "now" by patching
  // Date.now; the production path is unaffected.
  const now = new Date(Date.now());

  let priority: ParsedTask["priority"];
  let project: string | undefined;
  const tags: string[] = [];
  let dueDate: Date | undefined;
  let recurrence: string | undefined;
  // Track which project/tag tokens were resolved so unmatched ones stay in the
  // title instead of being silently dropped.
  const resolvedProjects = new Set<string>();
  const resolvedTags = new Set<string>();

  const words = tokens.map((t) => t.value);

  // Pass 1: recurrences (multi-word, e.g. "every monday"). Run before dates so
  // a bare weekday inside "every monday" is not mistaken for a one-off date.
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].kind === "word") {
      const rec = parseRecurrence(words.slice(i, i + 6));
      if (rec) {
        recurrence = rec.rrule;
        for (let k = i; k < i + rec.consumed; k++) tokens[k] = { kind: "recurrence", value: tokens[k].value };
        i += rec.consumed;
        continue;
      }
    }
    i += 1;
  }

  // Pass 2: everything else.
  i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.kind === "priority") {
      priority = t.value as ParsedTask["priority"];
    } else if (t.kind === "project") {
      const match = context?.projectNames?.find((p) => p.toLowerCase() === t.value.toLowerCase());
      if (match) {
        project = match;
        resolvedProjects.add(t.value);
      }
    } else if (t.kind === "tag") {
      const match = context?.tagNames?.find((tg) => tg.toLowerCase() === t.value.toLowerCase());
      if (match) {
        tags.push(match);
        resolvedTags.add(t.value);
      }
    } else if (t.kind === "date") {
      const parsed = parseSingleWordDate(t.value, now);
      if (parsed) dueDate = parsed;
    } else if (t.kind === "time") {
      const parsed = parseTime(t.value);
      if (parsed) {
        const base = dueDate ? new Date(dueDate) : startOfDay(now);
        base.setHours(parsed.hours, parsed.minutes, 0, 0);
        dueDate = base;
      }
    } else if (t.kind === "word") {
      const window = words.slice(i, i + 4);

      // "at 2pm" — apply the time to the resolved (or today's) due date.
      if (window[0] === "at" && parseTime(window[1] ?? "")) {
        const time = parseTime(window[1])!;
        const base = dueDate ? new Date(dueDate) : startOfDay(now);
        base.setHours(time.hours, time.minutes, 0, 0);
        dueDate = base;
        tokens[i] = { kind: "time", value: window[0] };
        tokens[i + 1] = { kind: "time", value: window[1] };
        i += 2;
        continue;
      }

      const monthDay = parseMonthDay(window, now);
      if (monthDay) {
        dueDate = monthDay.date;
        for (let k = i; k < i + monthDay.consumed; k++) tokens[k] = { kind: "date", value: tokens[k].value };
        i += monthDay.consumed;
        continue;
      }

      const phrase = parseDatePhrase(window, now);
      if (phrase) {
        dueDate = phrase.date;
        for (let k = i; k < i + phrase.consumed; k++) tokens[k] = { kind: "date", value: tokens[k].value };
        i += phrase.consumed;
        continue;
      }
    }

    i += 1;
  }

  // Rebuild the title from the remaining tokens, in order: plain words, plus
  // any project/tag tokens that did not resolve to a known name (their original
  // # / @ prefix is restored so nothing is silently dropped).
  const title = tokens
    .filter((t) => {
      if (t.kind === "word") return true;
      if (t.kind === "project") return !resolvedProjects.has(t.value);
      if (t.kind === "tag") return !resolvedTags.has(t.value);
      return false;
    })
    .map((t) => {
      if (t.kind === "project" && !resolvedProjects.has(t.value)) return `#${t.value}`;
      if (t.kind === "tag" && !resolvedTags.has(t.value)) return `@${t.value}`;
      return t.value;
    })
    .join(" ")
    .trim();

  return {
    title,
    dueDate,
    priority,
    project,
    tags: tags.length > 0 ? tags : undefined,
    recurrence,
    raw: input,
  };
}
