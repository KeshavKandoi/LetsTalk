ALTER TABLE `user_profile` ADD `is_findable` integer DEFAULT false NOT NULL;
ALTER TABLE `user_profile` ADD `location_hint` text;
ALTER TABLE `user_profile` ADD `ping_requested_at` integer;
ALTER TABLE `user_profile` ADD `ping_requested_by_user_id` text;
ALTER TABLE `user_profile` ADD `ping_requested_by_username` text;
