CREATE TABLE `report_event_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`raw_event_id` integer,
	`event_time` integer NOT NULL,
	`source` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`project_scope` text,
	`leadership_included` integer DEFAULT false NOT NULL,
	`personal_included` integer DEFAULT true NOT NULL,
	`source_revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`variant` text NOT NULL,
	`source_draft` text NOT NULL,
	`final_content` text,
	`final_status` text DEFAULT 'none' NOT NULL,
	`template_id` text,
	`template_name` text,
	`template_content` text,
	`ai_style` text,
	`source_revision` integer DEFAULT 1 NOT NULL,
	`score_status` text DEFAULT 'pending' NOT NULL,
	`score_structure` integer,
	`score_content` integer,
	`score_value` integer,
	`score_overall` integer,
	`suggestions` text,
	`score_error` text,
	`scored_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `report_variants_report_variant_unique` ON `report_variants` (`report_id`,`variant`);
--> statement-breakpoint
INSERT INTO `report_variants` (
	`report_id`,
	`variant`,
	`source_draft`,
	`final_content`,
	`final_status`,
	`ai_style`,
	`source_revision`,
	`score_status`,
	`score_structure`,
	`score_content`,
	`score_value`,
	`score_overall`,
	`suggestions`,
	`score_error`,
	`scored_at`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	'personal',
	'- 旧版周报无原稿',
	`content`,
	'current',
	`ai_style_override`,
	0,
	`score_status`,
	`score_structure`,
	`score_content`,
	`score_value`,
	`score_overall`,
	`suggestions`,
	`score_error`,
	`scored_at`,
	`created_at`,
	`updated_at`
FROM `reports`;
