ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "message_type" text DEFAULT 'text' NOT NULL;
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "media_key" text;
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "mime_type" text;
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "file_name" text;
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "file_size" integer;
ALTER TABLE "friend_message" ADD COLUMN IF NOT EXISTS "duration_ms" integer;
