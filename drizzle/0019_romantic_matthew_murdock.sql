CREATE TABLE `ai_styles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`system_prompt` text NOT NULL,
	`temperature` text DEFAULT '0.3' NOT NULL,
	`score_structure_weight` integer DEFAULT 25 NOT NULL,
	`score_content_weight` integer DEFAULT 30 NOT NULL,
	`score_value_weight` integer DEFAULT 45 NOT NULL,
	`detail_level` text,
	`result_oriented` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_styles_key_unique` ON `ai_styles` (`key`);--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`prompt_text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_prompts_key_unique` ON `system_prompts` (`key`);