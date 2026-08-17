-- Update templates table schema
ALTER TABLE templates DROP COLUMN work_types;
--> statement-breakpoint
ALTER TABLE templates DROP COLUMN is_default;
--> statement-breakpoint
ALTER TABLE templates ADD COLUMN description text;
--> statement-breakpoint
ALTER TABLE templates ADD COLUMN tags text;
--> statement-breakpoint
ALTER TABLE templates ADD COLUMN source_template_id text;
