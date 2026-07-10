CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"place_id" text,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reported_user_id_user_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_place_id_place_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("place_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_reporter_idx" ON "report" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "report_reported_idx" ON "report" USING btree ("reported_user_id");