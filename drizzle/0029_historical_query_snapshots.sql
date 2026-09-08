CREATE TABLE `generation_query_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`tool_name` text NOT NULL,
	`parameters` text NOT NULL,
	`called_at` integer NOT NULL,
	`source_report_id` integer NOT NULL,
	`source_audience` text NOT NULL,
	`source_updated_at` integer,
	`result` text NOT NULL,
	`result_count` integer DEFAULT 0 NOT NULL,
	`truncated` integer DEFAULT false NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`trigger` text NOT NULL,
	`previous_snapshot_id` integer,
	`created_at` integer NOT NULL
);
