CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`section_type` text,
	`color` text,
	`is_built_in` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
ALTER TABLE `raw_events` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `raw_events` ADD `is_important` integer DEFAULT false;