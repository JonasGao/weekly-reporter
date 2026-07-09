-- Remove the old branch field
UPDATE collect_sources
SET config = json_remove(config, '$.branch')
WHERE json_extract(config, '$.branch') IS NOT NULL;
