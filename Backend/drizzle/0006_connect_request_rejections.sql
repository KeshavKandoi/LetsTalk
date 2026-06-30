CREATE TABLE IF NOT EXISTS "connect_request_rejection" (
  "requester_user_id" text NOT NULL,
  "recipient_user_id" text NOT NULL,
  "rejection_count" integer NOT NULL DEFAULT 0,
  "last_rejected_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "spot_label" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "is_verified_on_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connect_request_rejection" ADD CONSTRAINT "connect_request_rejection_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect_request_rejection" ADD CONSTRAINT "connect_request_rejection_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connect_request_rejection_pair_unique" ON "connect_request_rejection" USING btree ("requester_user_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_request_rejection_requester_idx" ON "connect_request_rejection" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connect_request_rejection_recipient_idx" ON "connect_request_rejection" USING btree ("recipient_user_id");
