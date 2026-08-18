ALTER TABLE `report_variants` ADD `accepted_proposal_id` integer;--> statement-breakpoint
CREATE TABLE `generation_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`report_variant_id` integer NOT NULL,
	`variant` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source_revision` integer NOT NULL,
	`source_draft_snapshot` text NOT NULL,
	`source_overview` text NOT NULL,
	`template_id` text NOT NULL,
	`template_name` text NOT NULL,
	`template_content` text NOT NULL,
	`ai_style_key` text NOT NULL,
	`ai_style_label` text NOT NULL,
	`ai_style_prompt` text NOT NULL,
	`temperature` text NOT NULL,
	`system_prompt` text NOT NULL,
	`tool_rules` text NOT NULL,
	`baseline_final_content` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer
);--> statement-breakpoint
CREATE INDEX `generation_sessions_report_variant_idx` ON `generation_sessions` (`report_id`,`variant`);--> statement-breakpoint
CREATE TABLE `generation_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`status` text DEFAULT 'working' NOT NULL,
	`protocol` text NOT NULL,
	`model` text NOT NULL,
	`reasoning_effort` text,
	`error` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);--> statement-breakpoint
CREATE INDEX `generation_turns_session_idx` ON `generation_turns` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `generation_message_parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`turn_id` integer,
	`sequence` integer NOT NULL,
	`role` text NOT NULL,
	`part_type` text NOT NULL,
	`content` text,
	`data` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `generation_message_parts_session_sequence_unique` ON `generation_message_parts` (`session_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `generation_message_parts_turn_idx` ON `generation_message_parts` (`turn_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `generation_proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`turn_id` integer NOT NULL,
	`content` text NOT NULL,
	`summary` text NOT NULL,
	`source_revision` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer
);--> statement-breakpoint
CREATE INDEX `generation_proposals_session_idx` ON `generation_proposals` (`session_id`,`created_at`);
