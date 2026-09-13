CREATE TABLE `event_tags` (
	`event_id` integer NOT NULL,
	`tag_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_tags_event_tag_unique` ON `event_tags` (`event_id`,`tag_name`);--> statement-breakpoint
CREATE INDEX `event_tags_tag_name_idx` ON `event_tags` (`tag_name`);--> statement-breakpoint
ALTER TABLE `ai_styles` DROP COLUMN `score_structure_weight`;--> statement-breakpoint
ALTER TABLE `ai_styles` DROP COLUMN `score_content_weight`;--> statement-breakpoint
ALTER TABLE `ai_styles` DROP COLUMN `score_value_weight`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_status`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_structure`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_content`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_value`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_overall`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `suggestions`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `score_error`;--> statement-breakpoint
ALTER TABLE `report_variants` DROP COLUMN `scored_at`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_status`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_structure`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_content`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_value`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_overall`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `suggestions`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `score_error`;--> statement-breakpoint
ALTER TABLE `reports` DROP COLUMN `scored_at`;