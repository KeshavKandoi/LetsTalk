ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "photo_url" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "age" text;--> statement-breakpoint
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "gender" text;--> statement-breakpoint
CREATE TABLE "friend_request" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_user_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"place_id" text,
	"requester_accepted" boolean DEFAULT false NOT NULL,
	"recipient_accepted" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_request" ADD CONSTRAINT "friend_request_place_id_place_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("place_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_request_requester_idx" ON "friend_request" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "friend_request_recipient_idx" ON "friend_request" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_request_pair_unique" ON "friend_request" USING btree ("requester_user_id","recipient_user_id");
