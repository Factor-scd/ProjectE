// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, requireWorkspaceAccess, createErrorResponse } from '@/lib/auth';
import { db, tasks, habits, habitCompletions, projects, sections, domains } from '@project-e/db';
import { and, asc, between, eq, gte, isNull, lte, sql } from 'drizzle-orm';

type RouteContext = { params: Promise<{ domainId: string }> };

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'task' | 'habit' | 'project' | 'milestone';
  entityType: string;
  entityId: string;
  color: string;
  domainId: string;
  href: string;
  priority?: string;
  difficulty?: string;
  status?: string;
}

// GET /api/domains/[domainId]/calendar/events?from=&to=
// Returns all events (tasks with due_date, habits scheduled for date range, project target dates)
// joined with domain for color/title
export const GET = withAuth<RouteContext>(async (request: NextRequest, user, context) => {
  const { domainId } = await context!.params;
  await requireWorkspaceAccess(domainId);

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const types = searchParams.get('types')?.split(',').filter(Boolean) || ['task', 'habit', 'project', 'milestone'];

  if (!from || !to) {
    return createErrorResponse('VALIDATION_ERROR', 'from and to query params are required (ISO dates)', 400);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Get domain for color
  const [domain] = await db.select({ color: domains.color, name: domains.name })
    .from(domains)
    .where(eq(domains.id, domainId))
    .limit(1);

  const domainColor = domain?.color || '#3b82f6';
  const events: CalendarEvent[] = [];

  // 1. Tasks with due_date in range
  if (types.includes('task')) {
    const taskRows = await db.select()
      .from(tasks)
      .where(and(
        eq(tasks.domainId, domainId),
        isNull(tasks.deletedAt),
        gte(tasks.dueDate, fromDate),
        lte(tasks.dueDate, toDate),
      ))
      .orderBy(asc(tasks.dueDate));

    for (const task of taskRows) {
      if (!task.dueDate) continue;
      const color = task.priority === 'urgent' ? '#ef4444'
        : task.priority === 'high' ? '#f97316'
        : task.priority === 'medium' ? '#3b82f6'
        : '#6b7280';
      events.push({
        id: `task-${task.id}`,
        title: task.title,
        start: task.dueDate.toISOString(),
        end: task.dueDate.toISOString(),
        type: 'task',
        entityType: 'task',
        entityId: task.id,
        color,
        domainId,
        href: `/tasks/${task.id}`,
        priority: task.priority,
        status: task.status,
      });
    }
  }

  // 2. Habits — check if they have completions in range (scheduled habits)
  if (types.includes('habit')) {
    const habitRows = await db.select()
      .from(habits)
      .where(and(
        eq(habits.domainId, domainId),
        eq(habits.active, true),
        isNull(habits.deletedAt),
      ));

    for (const habit of habitRows) {
      const color = habit.difficulty === 'hard' ? '#ef4444'
        : habit.difficulty === 'medium' ? '#f97316'
        : '#22c55e';

      // Check if habit has completions in range
      const completions = await db.select({ date: habitCompletions.date })
        .from(habitCompletions)
        .where(and(
          eq(habitCompletions.habitId, habit.id),
          gte(habitCompletions.date, fromDate),
          lte(habitCompletions.date, toDate),
        ));

      const completedDates = new Set(completions.map(c => c.date.toISOString().split('T')[0]));

      // Generate events for each day in range (for daily habits)
      // For weekly/custom, just show the habit as a recurring event
      const current = new Date(fromDate);
      while (current <= toDate) {
        const dayOfWeek = current.getDay();
        const skipDays = (habit.skipDays || []) as number[];
        const dateStr = current.toISOString().split('T')[0];

        if (!skipDays.includes(dayOfWeek)) {
          const isCompleted = completedDates.has(dateStr);
          events.push({
            id: `habit-${habit.id}-${dateStr}`,
            title: `${isCompleted ? '✅ ' : '○ '}${habit.name}`,
            start: current.toISOString(),
            end: current.toISOString(),
            type: 'habit',
            entityType: 'habit',
            entityId: habit.id,
            color,
            domainId,
            href: '/habits',
            difficulty: habit.difficulty,
            status: isCompleted ? 'completed' : 'pending',
          });
        }
        current.setDate(current.getDate() + 1);
      }
    }
  }

  // 3. Projects with target_date in range
  if (types.includes('project')) {
    const projectRows = await db.select()
      .from(projects)
      .where(and(
        eq(projects.domainId, domainId),
        isNull(projects.deletedAt),
        gte(projects.targetDate, fromDate),
        lte(projects.targetDate, toDate),
      ))
      .orderBy(asc(projects.targetDate));

    for (const project of projectRows) {
      if (!project.targetDate) continue;
      events.push({
        id: `project-${project.id}`,
        title: `📁 ${project.name}`,
        start: project.targetDate.toISOString(),
        end: project.targetDate.toISOString(),
        type: 'project',
        entityType: 'project',
        entityId: project.id,
        color: project.color || '#8b5cf6',
        domainId,
        href: `/projects/${project.id}`,
        status: project.status,
      });
    }
  }

  // 4. Sections (milestones) with target_date in range
  if (types.includes('milestone')) {
    const milestoneRows = await db.select({
      id: sections.id,
      name: sections.name,
      targetDate: sections.targetDate,
      projectId: sections.projectId,
      status: sections.status,
      kind: sections.kind,
    })
      .from(sections)
      .innerJoin(projects, eq(sections.projectId, projects.id))
      .where(and(
        eq(projects.domainId, domainId),
        eq(sections.kind, 'milestone'),
        gte(sections.targetDate, fromDate),
        lte(sections.targetDate, toDate),
      ))
      .orderBy(asc(sections.targetDate));

    for (const milestone of milestoneRows) {
      if (!milestone.targetDate) continue;
      events.push({
        id: `milestone-${milestone.id}`,
        title: `🏁 ${milestone.name}`,
        start: milestone.targetDate.toISOString(),
        end: milestone.targetDate.toISOString(),
        type: 'milestone',
        entityType: 'section',
        entityId: milestone.id,
        color: '#f59e0b',
        domainId,
        href: `/projects/${milestone.projectId}`,
        status: milestone.status,
      });
    }
  }

  return NextResponse.json({ events });
});
