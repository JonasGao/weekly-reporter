CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`week_start` text NOT NULL,
	`week_end` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
