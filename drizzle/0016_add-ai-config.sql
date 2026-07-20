CREATE TABLE `ai_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`protocol` text DEFAULT 'openai' NOT NULL,
	`api_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text NOT NULL,
	`model_list_cache` text,
	`model_list_cached_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `raw_events` DROP COLUMN `status`;