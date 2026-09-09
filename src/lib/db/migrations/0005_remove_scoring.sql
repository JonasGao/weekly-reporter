-- Remove scoring columns from reports table
ALTER TABLE reports DROP COLUMN score_status;
ALTER TABLE reports DROP COLUMN score_structure;
ALTER TABLE reports DROP COLUMN score_content;
ALTER TABLE reports DROP COLUMN score_value;
ALTER TABLE reports DROP COLUMN score_overall;
ALTER TABLE reports DROP COLUMN suggestions;
ALTER TABLE reports DROP COLUMN score_error;
ALTER TABLE reports DROP COLUMN scored_at;

-- Remove scoring columns from report_variants table
ALTER TABLE report_variants DROP COLUMN score_status;
ALTER TABLE report_variants DROP COLUMN score_structure;
ALTER TABLE report_variants DROP COLUMN score_content;
ALTER TABLE report_variants DROP COLUMN score_value;
ALTER TABLE report_variants DROP COLUMN score_overall;
ALTER TABLE report_variants DROP COLUMN suggestions;
ALTER TABLE report_variants DROP COLUMN score_error;
ALTER TABLE report_variants DROP COLUMN scored_at;

-- Remove score weight columns from ai_styles table
ALTER TABLE ai_styles DROP COLUMN score_structure_weight;
ALTER TABLE ai_styles DROP COLUMN score_content_weight;
ALTER TABLE ai_styles DROP COLUMN score_value_weight;

-- Remove score system prompt
DELETE FROM system_prompts WHERE key = 'score';
