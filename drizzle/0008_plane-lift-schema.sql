-- Plane-Lift schema: big-bang break (DB is empty, no data migration)
-- Adds states, modules, cycles, links tables.
-- Drops note_links, note_entity_links, task_dependencies.
-- Drops tasks.status enum column, adds state_id/module_id/cycle_id FKs.
-- Drops the task_status enum type.

-- ── Drop old junction tables ────────────────────────────────────────────────────
DROP TABLE IF EXISTS "task_dependencies" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "note_links" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "note_entity_links" CASCADE;--> statement-breakpoint

-- ── Create new enums ───────────────────────────────────────────────────────────
CREATE TYPE "state_group" AS ENUM ('backlog', 'unstarted', 'started', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "module_status" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "link_type" AS ENUM ('relates', 'blocks', 'parent-child', 'created-from');--> statement-breakpoint

-- ── Create new tables ──────────────────────────────────────────────────────────
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"group" "state_group" NOT NULL DEFAULT 'unstarted',
	"project_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "states_project_id_idx" ON "states" ("project_id");--> statement-breakpoint
CREATE INDEX "states_sort_order_idx" ON "states" ("project_id","sort_order");--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_id" uuid NOT NULL,
	"status" "module_status" NOT NULL DEFAULT 'planned',
	"start_date" timestamp with time zone,
	"target_date" timestamp with time zone,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "modules_project_id_idx" ON "modules" ("project_id");--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_id" uuid NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"active" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "cycles_project_id_idx" ON "cycles" ("project_id");--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"link_type" "link_type" NOT NULL,
	"direction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "links_source_idx" ON "links" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "links_target_idx" ON "links" ("target_type","target_id");--> statement-breakpoint

-- ── Modify tasks table ─────────────────────────────────────────────────────────
ALTER TABLE "tasks" ADD COLUMN "state_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "module_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_state_id_idx" ON "tasks" ("state_id");--> statement-breakpoint
CREATE INDEX "tasks_module_id_idx" ON "tasks" ("module_id");--> statement-breakpoint
CREATE INDEX "tasks_cycle_id_idx" ON "tasks" ("cycle_id");--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "status";--> statement-breakpoint
DROP INDEX IF EXISTS "tasks_status_idx";--> statement-breakpoint

-- ── Drop old enum type ─────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "task_status" CASCADE;
