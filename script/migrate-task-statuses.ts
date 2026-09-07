import { fileURLToPath } from "node:url";
import { sql } from "../packages/db/src/client";

// Apply the custom-workflow-statuses migration idempotently.
// 0007_custom_task_statuses.sql uses CREATE ... IF NOT EXISTS, pg_constraint /
// information_schema guards, and idempotent backfill UPDATEs, so it is safe to
// run on every deploy. It must run BEFORE `drizzle-kit push`: the push removes
// the legacy tasks.status column and task_status enum type, and this script
// backfills tasks.status_id from that column first.
const statusesFile = fileURLToPath(
  new URL("../drizzle/0007_custom_task_statuses.sql", import.meta.url),
);

try {
  console.log(`Applying custom task statuses migration from ${statusesFile} ...`);
  await sql.file(statusesFile);
  console.log("Custom task statuses migration applied successfully.");
  process.exit(0);
} catch (error) {
  console.error("Failed to apply custom task statuses migration:", error);
  process.exit(1);
}