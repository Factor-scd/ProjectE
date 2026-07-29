import { db, domains, notes, users } from '@project-e/db';
import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';

/**
 * Seed the database with default data on first boot.
 * Creates:
 * - "Personal" workspace domain
 * - Welcome note demonstrating wikilinks
 */
export async function seedDefaultData(): Promise<void> {
  const [{ total }] = await db.select({ total: count() }).from(domains);

  if (total > 0) {
    return; // Already seeded
  }

  // Create Personal workspace
  const [personalDomain] = await db
    .insert(domains)
    .values({
      name: 'Personal',
      slug: 'personal',
      color: '#356bff',
      icon: 'user',
      sortOrder: 0,
    })
    .returning();

  // Create welcome note
  await db.insert(notes).values({
    title: 'Welcome to Project E',
    content: `# Welcome to Project E 🎉

Your personal productivity OS is ready.

## Getting Started

- Use **Cmd+K** to open the command palette
- Navigate to **Tasks**, **Habits**, **Projects**, or **Notes** from the sidebar
- Create your first task with \`c t\` or click the + button

## Features

- **Tasks** — Full kanban board with drag-to-reorder, subtasks, dependencies, and time tracking
- **Habits** — Streak tracking with mood logging and reminders
- **Projects** — Milestone-based project management with sections
- **Notes** — Markdown editor with [[wikilinks]] and backlinks
- **Graph** — Visualize connections between all your entities
- **Calendar** — See everything on a timeline
- **Realtime** — Changes sync instantly across all open windows

## Links

- [[Tasks]] — View all tasks
- [[Habits]] — View all habits
- [[Projects]] — View all projects
- [[Notes]] — View all notes

> Tip: You can link to any entity using [[entity:title]] syntax in your notes.
`,
    domainId: personalDomain.id,
    isPinned: true,
  });

  console.log('[seed] Default data created: Personal workspace + welcome note');
}
