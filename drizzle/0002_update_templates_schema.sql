-- Update templates table schema
-- Drop old columns (if they exist)
ALTER TABLE templates DROP COLUMN IF EXISTS work_types;
ALTER TABLE templates DROP COLUMN IF EXISTS is_default;

-- Add new columns (if they don't exist)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS source_template_id text;