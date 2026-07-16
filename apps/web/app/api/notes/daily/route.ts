import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createErrorResponse } from '@/lib/auth';
import { createPocketBaseClient } from '@/lib/pocketbase';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a "YYYY-MM-DD" string into start/end ISO boundaries (UTC). */
function dayBounds(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Format minutes into a human-readable "Xh Ym" string. */
function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Escape HTML special characters. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build an <ul> of items, or an empty-state <p> if the list is empty. */
function list(items: string[], emptyMsg: string): string {
  if (items.length === 0) {
    return `<p><em>${esc(emptyMsg)}</em></p>`;
  }
  return `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
}

/** Generate the full HTML body for a daily note. */
function buildDailyNoteHtml(ctx: {
  completedTasks: string[];
  habitLogs: string[];
  timeEntries: string[];
  overdueTasks: string[];
}): string {
  return [
    `<h2>Tasks Completed</h2>`,
    list(ctx.completedTasks, 'No tasks completed today.'),
    `<h2>Habits Logged</h2>`,
    list(ctx.habitLogs, 'No habits logged today.'),
    `<h2>Time Tracked</h2>`,
    list(ctx.timeEntries, 'No time tracked today.'),
    `<h2>Overdue Items</h2>`,
    list(ctx.overdueTasks, 'Nothing overdue.'),
    `<h2>Notes</h2>`,
    `<p></p>`,
    `<h2>Reflections</h2>`,
    `<p></p>`,
    `<h2>Gratitude</h2>`,
    `<p></p>`,
  ].join('\n');
}

// ── Route handlers ───────────────────────────────────────────────────────────

/** GET /api/notes/daily?date=YYYY-MM-DD — return the daily note if it exists. */
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return createErrorResponse(
      'VALIDATION_ERROR',
      'A valid date parameter (YYYY-MM-DD) is required.',
      400
    );
  }

  const title = `Daily Note - ${date}`;
  const pb = createPocketBaseClient();

  const result = await pb.collection('notes').getList(1, 1, {
    filter: `title = "${title}"`,
  });

  if (result.items.length === 0) {
    return NextResponse.json({ note: null });
  }

  return NextResponse.json({ note: result.items[0] });
});

/** POST /api/notes/daily — create today's daily note (idempotent). */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const date: string | undefined = body?.date;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'A valid date string (YYYY-MM-DD) is required in the request body.',
        400
      );
    }

    const title = `Daily Note - ${date}`;
    const pb = createPocketBaseClient();

    // ── 1. Idempotency check ────────────────────────────────────────────────
    const existing = await pb.collection('notes').getList(1, 1, {
      filter: `title = "${title}"`,
    });
    if (existing.items.length > 0) {
      return NextResponse.json(existing.items[0]);
    }

    // ── 2. Date boundaries ──────────────────────────────────────────────────
    const { start, end } = dayBounds(date);

    // ── 3. Fetch all data in parallel ───────────────────────────────────────
    const [
      completedTaskRecords,
      habitLogRecords,
      timeEntryRecords,
      overdueTaskRecords,
      habitsAll,
    ] = await Promise.all([
      // Tasks completed today
      pb.collection('tasks').getFullList({
        filter: `completed_at >= "${start}" && completed_at <= "${end}"`,
        sort: 'completed_at',
      }),
      // Habit logs for the day
      pb.collection('habit_logs').getFullList({
        filter: `logged_at >= "${start}" && logged_at <= "${end}"`,
        sort: 'logged_at',
      }),
      // Time entries for the day
      pb.collection('task_time_entries').getFullList({
        filter: `started_at >= "${start}" && started_at <= "${end}"`,
        sort: 'started_at',
      }),
      // Overdue tasks (due before today, not done)
      pb.collection('tasks').getFullList({
        filter: `due_date < "${start}" && status != "done" && status != "cancelled"`,
        sort: 'due_date',
      }),
      // All active habits (for name lookup)
      pb.collection('habits').getFullList({
        filter: 'active = true',
      }),
    ]);

    // ── 4. Build lookup maps ────────────────────────────────────────────────
    const habitNameById = new Map<string, string>();
    for (const h of habitsAll) {
      habitNameById.set(h.id, h.name as string);
    }

    // Collect task IDs from time entries so we can resolve names
    const taskIdsForTimeEntries = [
      ...new Set(timeEntryRecords.map((e) => e.task_id as string)),
    ];
    const taskNamesMap = new Map<string, string>();

    // Fetch task names in parallel for time entries and overdue tasks
    const allTaskIds = new Set<string>();
    for (const t of completedTaskRecords) allTaskIds.add(t.id);
    for (const t of overdueTaskRecords) allTaskIds.add(t.id);
    for (const id of taskIdsForTimeEntries) allTaskIds.add(id);

    const taskFetches = await Promise.allSettled(
      [...allTaskIds].map((id) => pb.collection('tasks').getOne(id))
    );
    for (const res of taskFetches) {
      if (res.status === 'fulfilled') {
        const t = res.value;
        taskNamesMap.set(t.id, t.title as string);
      }
    }

    // ── 5. Format sections ──────────────────────────────────────────────────
    const completedTasks = completedTaskRecords.map((t) => {
      const name = taskNamesMap.get(t.id) ?? (t.title as string);
      return `${esc(name)}`;
    });

    const habitLogs = habitLogRecords.map((log) => {
      const habitName = habitNameById.get(log.habit_id) ?? 'Unknown habit';
      const status = log.completed ? '✓' : log.skipped ? 'skipped' : '—';
      const mood = log.mood != null ? ` (mood: ${log.mood}/5)` : '';
      return `${esc(habitName)} — ${status}${mood}`;
    });

    const timeEntries = timeEntryRecords.map((entry) => {
      const taskName = taskNamesMap.get(entry.task_id as string) ?? 'Unknown task';
      const dur = formatMinutes((entry.duration_minutes as number) || 0);
      const notes = entry.notes ? ` — ${esc(entry.notes as string)}` : '';
      return `<strong>${dur}</strong> on ${esc(taskName)}${notes}`;
    });

    const overdueTasks = overdueTaskRecords.map((t) => {
      const name = taskNamesMap.get(t.id) ?? (t.title as string);
      const due = t.due_date
        ? ` (due ${new Date(t.due_date as string).toLocaleDateString()})`
        : '';
      return `${esc(name)}${due}`;
    });

    // ── 6. Build HTML content ───────────────────────────────────────────────
    const content = buildDailyNoteHtml({
      completedTasks,
      habitLogs,
      timeEntries,
      overdueTasks,
    });

    // ── 7. Create note ──────────────────────────────────────────────────────
    const note = await pb.collection('notes').create({
      title,
      content,
      domain: 'personal',
      tags: ['daily'],
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Failed to create daily note:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to create daily note.',
      500
    );
  }
});
