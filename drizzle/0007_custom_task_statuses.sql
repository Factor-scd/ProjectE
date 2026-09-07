-- Custom workflow statuses: replace the fixed task_status enum
-- (todo/in_progress/done/cancelled) with per-project status_definitions rows.
--
-- Idempotent — safe to run on every deploy BEFORE `drizzle-kit push`. The push
-- then removes the legacy `tasks.status` column and the `task_status` enum type,
-- which is why the backfill must run first:
--
--   1. Create the status_category enum + status_definitions table if missing.
--   2. Seed the four default statuses (todo/in_progress/done/cancelled) for
--      every project that has none yet.
--   3. Backfill tasks.status_id by joining on the legacy `status` column when it
--      still exists; otherwise fall back to each project's default status.
--
-- Fresh installs (no projects table yet) skip the data steps; the API seeds
-- default statuses when a project is created.

-- ─── 1. status_category enum (Postgres has no CREATE TYPE IF NOT EXISTS) ──────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_category') THEN
    CREATE TYPE "status_category" AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
  END IF;
END $$;

-- ─── 2. status_definitions table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "status_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"category" "status_category" DEFAULT 'todo' NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'status_definitions_project_id_projects_id_fk') THEN
    ALTER TABLE "status_definitions" ADD CONSTRAINT "status_definitions_project_id_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "status_definitions_project_key_idx" ON "status_definitions" USING btree ("project_id","key");
CREATE INDEX IF NOT EXISTS "status_definitions_project_id_idx" ON "status_definitions" USING btree ("project_id");

-- ─── 3. tasks.status_id column ──────────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "status_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_id_status_definitions_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_status_definitions_id_fk"
      FOREIGN KEY ("status_id") REFERENCES "public"."status_definitions"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_status_id_idx" ON "tasks" USING btree ("status_id");

-- ─── 4. Seed default statuses per project ───────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL AND to_regclass('public.status_definitions') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO "status_definitions" ("project_id", "key", "label", "category", "color", "sort_order", "is_default")
      SELECT p."id", d."key", d."label", d."category", d."color", d."sort_order", d."is_default"
      FROM "projects" p
      CROSS JOIN (VALUES
        (''todo'', ''Todo'', ''todo'', ''#94a3b8'', 0, true),
        (''in_progress'', ''In Progress'', ''in_progress'', ''#3b82f6'', 1, false),
        (''done'', ''Done'', ''done'', ''#22c55e'', 2, false),
        (''cancelled'', ''Cancelled'', ''cancelled'', ''#ef4444'', 3, false)
      ) AS d("key", "label", "category", "color", "sort_order", "is_default")
      WHERE NOT EXISTS (
        SELECT 1 FROM "status_definitions" sd WHERE sd."project_id" = p."id"
      )';
  END IF;
END $$;

-- ─── 5. Backfill tasks.status_id ────────────────────────────────────────────────
-- Legacy status column still present → map each task to the status with the
-- same key in its project (preserves the old todo/in_progress/done/cancelled).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status_id'
  ) THEN
    EXECUTE '
      UPDATE "tasks" t
      SET "status_id" = sd."id"
      FROM "status_definitions" sd
      WHERE t."project_id" = sd."project_id"
        AND t."status"::text = sd."key"
        AND t."status_id" IS NULL';
  END IF;
END $$;

-- Legacy column already gone (or never existed) → assign each null-status task
-- its project''s default status so nothing is left un-categorized.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'status'
  ) THEN
    EXECUTE '
      UPDATE "tasks" t
      SET "status_id" = sd."id"
      FROM "status_definitions" sd
      WHERE sd."project_id" = t."project_id"
        AND sd."is_default" = true
        AND t."status_id" IS NULL';
  END IF;
END $$;