-- Add scoring fields to reports table
ALTER TABLE reports ADD COLUMN score_status TEXT NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN score_structure INTEGER;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN score_content INTEGER;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN score_value INTEGER;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN score_overall INTEGER;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN suggestions TEXT;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN score_error TEXT;
--> statement-breakpoint
ALTER TABLE reports ADD COLUMN scored_at INTEGER;
