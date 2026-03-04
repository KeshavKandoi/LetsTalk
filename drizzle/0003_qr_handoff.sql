CREATE TABLE `handoff_code` (
  `token` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `place_id` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`place_id`) REFERENCES `place`(`place_id`) ON DELETE cascade
);

CREATE UNIQUE INDEX `handoff_code_user_unique` ON `handoff_code` (`user_id`);
CREATE INDEX `handoff_code_place_idx` ON `handoff_code` (`place_id`);

CREATE TABLE `handoff_connection` (
  `id` text PRIMARY KEY NOT NULL,
  `requester_user_id` text NOT NULL,
  `recipient_user_id` text NOT NULL,
  `place_id` text NOT NULL,
  `status` text DEFAULT 'accepted' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`place_id`) REFERENCES `place`(`place_id`) ON DELETE cascade
);

CREATE INDEX `handoff_connection_requester_idx` ON `handoff_connection` (`requester_user_id`);
CREATE INDEX `handoff_connection_recipient_idx` ON `handoff_connection` (`recipient_user_id`);
CREATE INDEX `handoff_connection_place_idx` ON `handoff_connection` (`place_id`);
