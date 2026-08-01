ALTER TABLE "domains" ADD COLUMN "owner_id" uuid REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "domains_owner_id_idx" ON "domains" USING btree ("owner_id");
