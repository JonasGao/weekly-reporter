ALTER TABLE `generation_proposals` ADD `plan_state` text;
--> statement-breakpoint
CREATE TABLE `generation_plan_judgments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`candidate_id` text NOT NULL,
	`judgment` text NOT NULL,
	`reason` text NOT NULL,
	`remaining_action` text,
	`turn_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_plan_judgments_session_candidate_unique` ON `generation_plan_judgments` (`session_id`,`candidate_id`);
--> statement-breakpoint
CREATE INDEX `generation_plan_judgments_session_idx` ON `generation_plan_judgments` (`session_id`,`created_at`);
