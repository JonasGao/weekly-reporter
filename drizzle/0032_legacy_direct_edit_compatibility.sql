-- Legacy reports predate source drafts and generation sessions. Remove only the
-- placeholder variant created by migration 0021; never invent a replacement.
DELETE FROM `report_variants`
WHERE `source_revision` = 0
  AND `variant` = 'personal'
  AND `source_draft` = '- 旧版周报无原稿'
  AND `accepted_proposal_id` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `report_event_snapshots`
    WHERE `report_event_snapshots`.`report_id` = `report_variants`.`report_id`
  );
