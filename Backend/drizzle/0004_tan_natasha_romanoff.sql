DROP INDEX "user_username_unique";--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN "about" text;--> statement-breakpoint
CREATE INDEX "user_username_idx" ON "user" USING btree ("username");