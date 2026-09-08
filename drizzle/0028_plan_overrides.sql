CREATE TABLE `generation_plan_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`action` text NOT NULL,
	`replacement_text` text,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_plan_overrides_session_idx` ON `generation_plan_overrides` (`session_id`,`id`);