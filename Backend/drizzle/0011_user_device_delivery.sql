ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "client_id" text;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "message_type" text DEFAULT 'text' NOT NULL;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "media_key" text;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "mime_type" text;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "file_name" text;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "file_size" integer;
--> statement-breakpoint
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_message_recipient_status_idx" ON "friend_message" USING btree ("recipient_user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_device" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "push_token" text NOT NULL,
  "platform" text DEFAULT 'android' NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  CONSTRAINT "user_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_device_push_token_unique" ON "user_device" USING btree ("push_token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_device_user_idx" ON "user_device" USING btree ("user_id");
