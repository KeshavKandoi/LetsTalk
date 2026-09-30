-- Add status, sent_at, read_at, client_id to friend_message
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'sent' NOT NULL;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "read_at" timestamp;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "client_id" text;
--> statement-breakpoint
-- Backfill: mark all existing messages as sent
UPDATE "friend_message" SET "status" = 'sent', "sent_at" = "created_at" WHERE "status" = 'sent' AND "sent_at" IS NULL;
--> statement-breakpoint
-- Add user_activity table if it doesn't exist
CREATE TABLE IF NOT EXISTS "user_activity" (
  "user_id" text PRIMARY KEY NOT NULL,
  "is_online" boolean DEFAULT false NOT NULL,
  "last_seen_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "user_activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
-- Indexes for common chat queries
CREATE INDEX IF NOT EXISTS "friend_message_created_idx" ON "friend_message" USING btree ("friend_request_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_message_client_id_idx" ON "friend_message" USING btree ("client_id") WHERE "client_id" IS NOT NULL;
