UPDATE `collect_sources` SET `status` = 'disabled' WHERE `enabled` = 0;
UPDATE `collect_sources` SET `status` = 'enabled' WHERE `enabled` = 1;
