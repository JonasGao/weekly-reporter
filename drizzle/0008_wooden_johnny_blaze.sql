PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`description` text,
	`tags` text,
	`source_template_id` text,
	`ai_style` text DEFAULT 'formal' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_templates`("id", "name", "content", "description", "tags", "source_template_id", "ai_style", "config", "created_at", "updated_at") SELECT "id", "name", "content", "description", "tags", "source_template_id", "ai_style", "config", "created_at", "updated_at" FROM `templates`;--> statement-breakpoint
DROP TABLE `templates`;--> statement-breakpoint
ALTER TABLE `__new_templates` RENAME TO `templates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;