ALTER TABLE "domains" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
CREATE INDEX "domains_search_idx" ON "domains" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "habits_search_idx" ON "habits" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "notes_search_idx" ON "notes" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "projects_search_idx" ON "projects" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_vector");