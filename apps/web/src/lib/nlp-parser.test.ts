import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { parseQuickAdd } from "./nlp-parser";

// Deterministic "now" so date math is stable across runs. Tests that rely on
// calendar dates are anchored relative to this fixed reference point.
const NOW = new Date("2026-08-19T12:00:00"); // a Wednesday

function parse(input: string, context?: Parameters<typeof parseQuickAdd>[1]) {
  return parseQuickAdd(input, context);
}

// Helper: same calendar day check regardless of time component.
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Patch Date.now for the tests that compute relative dates.
describe("nlp-parser", () => {
  const realNow = Date.now;
  beforeEach(() => {
    Date.now = () => NOW.getTime();
  });
  afterEach(() => {
    Date.now = realNow;
  });

  describe("title extraction", () => {
    it("keeps plain text as the title", () => {
      const r = parse("buy milk");
      expect(r.title).toBe("buy milk");
    });

    it("removes recognized tokens from the title", () => {
      const r = parse("buy milk tomorrow !high");
      expect(r.title).toBe("buy milk");
    });

    it("trims surrounding whitespace from the title", () => {
      const r = parse("  buy milk  tomorrow  ");
      expect(r.title).toBe("buy milk");
    });

    it("keeps multiple words in original order", () => {
      const r = parse("fix login bug in the auth flow");
      expect(r.title).toBe("fix login bug in the auth flow");
    });
  });

  describe("priority", () => {
    it("parses !urgent", () => {
      expect(parse("ship !urgent").priority).toBe("urgent");
    });
    it("parses !high", () => {
      expect(parse("ship !high").priority).toBe("high");
    });
    it("parses !medium", () => {
      expect(parse("ship !medium").priority).toBe("medium");
    });
    it("parses !low", () => {
      expect(parse("ship !low").priority).toBe("low");
    });
    it("parses !! as urgent", () => {
      expect(parse("ship !!").priority).toBe("urgent");
    });
    it("is case-insensitive", () => {
      expect(parse("ship !HIGH").priority).toBe("high");
    });
  });

  describe("dates", () => {
    it("parses tomorrow as next day", () => {
      const r = parse("buy milk tomorrow");
      expect(r.dueDate).toBeDefined();
      expect(sameDay(r.dueDate!, new Date(2026, 7, 20))).toBe(true);
    });

    it("parses in 3 days", () => {
      const r = parse("fix bug in 3 days");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 22))).toBe(true);
    });

    it("parses in 2 weeks", () => {
      const r = parse("plan in 2 weeks");
      expect(sameDay(r.dueDate!, new Date(2026, 8, 2))).toBe(true);
    });

    it("parses next friday", () => {
      // NOW is Wed 2026-08-19; next friday is 2026-08-21.
      const r = parse("review PR next friday");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 21))).toBe(true);
    });

    it("parses a bare weekday as the next occurrence", () => {
      // NOW is Wed 2026-08-19; next monday is 2026-08-24.
      const r = parse("standup monday");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 24))).toBe(true);
    });

    it("parses ISO date 2025-01-15", () => {
      const r = parse("deadline 2025-01-15");
      expect(sameDay(r.dueDate!, new Date(2025, 0, 15))).toBe(true);
    });

    it("parses month name + day (dec 25)", () => {
      const r = parse("gift dec 25");
      expect(sameDay(r.dueDate!, new Date(2026, 11, 25))).toBe(true);
    });

    it("parses end of month", () => {
      const r = parse("report end of month");
      // Aug 2026 has 31 days.
      expect(sameDay(r.dueDate!, new Date(2026, 7, 31))).toBe(true);
    });

    it("parses next week", () => {
      const r = parse("event next week");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 26))).toBe(true);
    });
  });

  describe("times", () => {
    it("parses at 2pm on a date", () => {
      const r = parse("call tomorrow at 2pm");
      expect(r.dueDate!.getHours()).toBe(14);
      expect(r.dueDate!.getMinutes()).toBe(0);
    });

    it("parses at 9am on a date", () => {
      const r = parse("standup tomorrow at 9am");
      expect(r.dueDate!.getHours()).toBe(9);
    });

    it("parses 24h time at 14:30", () => {
      const r = parse("meeting tomorrow at 14:30");
      expect(r.dueDate!.getHours()).toBe(14);
      expect(r.dueDate!.getMinutes()).toBe(30);
    });

    it("removes the time phrase from the title", () => {
      const r = parse("call tomorrow at 2pm");
      expect(r.title).toBe("call");
    });
  });

  describe("projects and tags", () => {
    it("resolves #project to a known project name", () => {
      const r = parse("buy milk #work", { projectNames: ["Work", "Personal"] });
      expect(r.project).toBe("Work");
    });

    it("resolves @tag to a known tag name", () => {
      const r = parse("task @sarah", { tagNames: ["sarah", "billing"] });
      expect(r.tags).toEqual(["sarah"]);
    });

    it("keeps unknown #project in the title", () => {
      const r = parse("fix #hashtag bug", { projectNames: ["Work"] });
      expect(r.project).toBeUndefined();
      expect(r.title).toContain("#hashtag");
    });

    it("keeps unknown @tag in the title", () => {
      const r = parse("mention @nobody", { tagNames: ["sarah"] });
      expect(r.tags).toBeUndefined();
      expect(r.title).toContain("@nobody");
    });

    it("resolves multiple tags", () => {
      const r = parse("task @a @b", { tagNames: ["a", "b", "c"] });
      expect(r.tags).toEqual(["a", "b"]);
    });
  });

  describe("recurrence", () => {
    it("parses daily", () => {
      expect(parse("standup daily").recurrence).toBe("FREQ=DAILY");
    });
    it("parses weekly", () => {
      expect(parse("review weekly").recurrence).toBe("FREQ=WEEKLY");
    });
    it("parses monthly", () => {
      expect(parse("report monthly").recurrence).toBe("FREQ=MONTHLY");
    });
    it("parses every monday", () => {
      expect(parse("standup every monday").recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    });
    it("parses every 2 weeks", () => {
      expect(parse("review every 2 weeks").recurrence).toBe("FREQ=WEEKLY;INTERVAL=2");
    });
    it("parses every month on the 15th", () => {
      expect(parse("bill every month on the 15th").recurrence).toBe(
        "FREQ=MONTHLY;BYMONTHDAY=15"
      );
    });
    it("removes recurrence words from the title", () => {
      const r = parse("standup every monday");
      expect(r.title).toBe("standup");
    });
  });

  describe("combined & edge cases", () => {
    it("parses a full example", () => {
      const r = parse("buy milk tomorrow !high #work @sarah every monday", {
        projectNames: ["work"],
        tagNames: ["sarah"],
      });
      expect(r.title).toBe("buy milk");
      expect(r.priority).toBe("high");
      expect(r.project).toBe("work");
      expect(r.tags).toEqual(["sarah"]);
      expect(r.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 20))).toBe(true);
    });

    it("parses review PR !urgent next friday", () => {
      const r = parse("review PR !urgent next friday");
      expect(r.title).toBe("review PR");
      expect(r.priority).toBe("urgent");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 21))).toBe(true);
    });

    it("parses team standup daily at 9am #engineering", () => {
      const r = parse("team standup daily at 9am #engineering", {
        projectNames: ["engineering"],
      });
      expect(r.title).toBe("team standup");
      expect(r.recurrence).toBe("FREQ=DAILY");
      expect(r.dueDate!.getHours()).toBe(9);
      expect(r.project).toBe("engineering");
    });

    it("parses fix login bug in 3 days !high #backend", () => {
      const r = parse("fix login bug in 3 days !high #backend", {
        projectNames: ["backend"],
      });
      expect(r.title).toBe("fix login bug");
      expect(r.priority).toBe("high");
      expect(r.project).toBe("backend");
      expect(sameDay(r.dueDate!, new Date(2026, 7, 22))).toBe(true);
    });

    it("keeps the raw input", () => {
      const input = "buy milk tomorrow !high";
      expect(parse(input).raw).toBe(input);
    });

    it("returns empty title for only-metadata input", () => {
      const r = parse("!high tomorrow", { projectNames: [] });
      expect(r.title).toBe("");
      expect(r.priority).toBe("high");
    });
  });
});
