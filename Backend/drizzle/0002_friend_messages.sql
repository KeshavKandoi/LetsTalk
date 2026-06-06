CREATE TABLE "friend_message" (
	"id" text PRIMARY KEY NOT NULL,
	"friend_request_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "friend_message" ADD CONSTRAINT "friend_message_friend_request_id_friend_request_id_fk" FOREIGN KEY ("friend_request_id") REFERENCES "public"."friend_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_message" ADD CONSTRAINT "friend_message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_message" ADD CONSTRAINT "friend_message_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_message_request_idx" ON "friend_message" USING btree ("friend_request_id");--> statement-breakpoint
CREATE INDEX "friend_message_sender_idx" ON "friend_message" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "friend_message_recipient_idx" ON "friend_message" USING btree ("recipient_user_id");
