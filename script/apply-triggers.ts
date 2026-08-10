import { fileURLToPath } from "node:url";
import { sql } from "../db/client";

// Apply the search-vector trigger migration idempotently.
// 0005_search_vector_trigger.sql uses CREATE OR REPLACE FUNCTION, DROP TRIGGER
// IF EXISTS + CREATE TRIGGER, and idempotent backfill UPDATEs, so it is safe
// to run on every deploy.
const triggerFile = fileURLToPath(
  new URL("../drizzle/0005_search_vector_trigger.sql", import.meta.url),
);

try {
  console.log(`Applying search-vector triggers from ${triggerFile} ...`);
  await sql.file(triggerFile);
  console.log("Search-vector triggers applied successfully.");
  process.exit(0);
} catch (error) {
  console.error("Failed to apply search-vector triggers:", error);
  process.exit(1);
}
