PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ai_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`protocol` text DEFAULT 'openai-compatible' NOT NULL,
	`api_url` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text NOT NULL,
	`model_list_cache` text,
	`model_list_cached_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_ai_config`("id", "protocol", "api_url", "api_key", "model", "model_list_cache", "model_list_cached_at", "created_at", "updated_at") SELECT "id", "protocol", "api_url", "api_key", "model", "model_list_cache", "model_list_cached_at", "created_at", "updated_at" FROM `ai_config`;--> statement-breakpoint
DROP TABLE `ai_config`;--> statement-breakpoint
ALTER TABLE `__new_ai_config` RENAME TO `ai_config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `collect_sources` ADD `project_scope` text DEFAULT 'personal' NOT NULL;