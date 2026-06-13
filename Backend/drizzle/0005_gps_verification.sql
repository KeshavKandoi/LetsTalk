ALTER TABLE "place" ADD COLUMN IF NOT EXISTS "latitude" real;--> statement-breakpoint
ALTER TABLE "place" ADD COLUMN IF NOT EXISTS "longitude" real;--> statement-breakpoint
UPDATE "place" SET "latitude" = "lat" WHERE "latitude" IS NULL;--> statement-breakpoint
UPDATE "place" SET "longitude" = "lng" WHERE "longitude" IS NULL;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "is_verified_on_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
