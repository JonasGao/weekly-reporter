ALTER TABLE `collect_sources` ADD `status` text DEFAULT 'enabled';
UPDATE `collect_sources` SET `status` = 'disabled' WHERE `enabled` = 0;
UPDATE `collect_sources` SET `status` = 'enabled' WHERE `enabled` = 1;