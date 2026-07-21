-- Add scoring fields to reports table
ALTER TABLE reports ADD COLUMN score_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN score_structure INTEGER;
ALTER TABLE reports ADD COLUMN score_content INTEGER;
ALTER TABLE reports ADD COLUMN score_value INTEGER;
ALTER TABLE reports ADD COLUMN score_overall INTEGER;
ALTER TABLE reports ADD COLUMN suggestions TEXT;
ALTER TABLE reports ADD COLUMN score_error TEXT;
ALTER TABLE reports ADD COLUMN scored_at INTEGER;