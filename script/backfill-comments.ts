import { db, activityFeed, comments, tasks } from "@project-e/db";
import { and, asc, eq, isNull } from "drizzle-orm";

// Backfill legacy comments from activity_feed (entity_type='comment') into the
// new dedicated comments table. Comments were only ever created for tasks, so
// every row maps to entity_type='task' with no parent.
//
// Idempotent: rows that already exist in `comments` (same entity_id + content +
// created_at) are skipped, so this script is safe to re-run.

try {
  const rows = await db
    .select()
    .from(activityFeed)
    .where(eq(activityFeed.entityType, "comment"))
    .orderBy(asc(activityFeed.createdAt));

  let inserted = 0;
  let alreadyPresent = 0;
  let missingContent = 0;
  let orphaned = 0;

  for (const row of rows) {
    const content = row.changes?.content;
    if (typeof content !== "string" || content.trim() === "") {
      missingContent++;
      continue;
    }

    // Only backfill comments whose task still exists (skip soft-deleted/absent).
    const [task] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, row.entityId), isNull(tasks.deletedAt)))
      .limit(1);

    if (!task) {
      orphaned++;
      continue;
    }

    // Idempotency guard: skip if this comment was already migrated.
    const [existing] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(
        eq(comments.entityId, row.entityId),
        eq(comments.content, content),
        eq(comments.createdAt, row.createdAt),
      ))
      .limit(1);

    if (existing) {
      alreadyPresent++;
      continue;
    }

    await db.insert(comments).values({
      entityType: "task",
      entityId: row.entityId,
      workspaceId: row.workspaceId,
      author: row.actor,
      content,
      createdAt: row.createdAt,
      parentId: null,
      deletedAt: null,
    });

    inserted++;
  }

  console.log(`[backfill-comments] rows found: ${rows.length}`);
  console.log(`[backfill-comments] inserted: ${inserted}`);
  console.log(`[backfill-comments] skipped (already present): ${alreadyPresent}`);
  console.log(`[backfill-comments] skipped (missing content): ${missingContent}`);
  console.log(`[backfill-comments] skipped (orphaned entity): ${orphaned}`);

  process.exit(0);
} catch (error) {
  console.error("[backfill-comments] failed:", error);
  process.exit(1);
}
