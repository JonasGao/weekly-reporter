-- Migrate branch (string) to branches (array) in config JSON
-- For records with a non-null branch field, convert to branches array
UPDATE collect_sources
SET config = json_set(config, '$.branches', json_array(json_extract(config, '$.branch')))
WHERE json_extract(config, '$.branch') IS NOT NULL
  AND json_extract(config, '$.branch') != '';

-- Remove the old branch field
UPDATE collect_sources
SET config = json_remove(config, '$.branch')
WHERE json_extract(config, '$.branch') IS NOT NULL;
