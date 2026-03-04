CREATE TABLE `user_profile` (
  `user_id` text PRIMARY KEY NOT NULL,
  `mood_emoji` text,
  `intent_text` text,
  `intent_summary` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);

CREATE TABLE `place` (
  `place_id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `address` text NOT NULL,
  `lat` real NOT NULL,
  `lng` real NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
