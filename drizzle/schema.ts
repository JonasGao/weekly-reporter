import { sqliteTable, AnySQLiteColumn, integer, text } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const reports = sqliteTable("reports", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	title: text().notNull(),
	content: text().notNull(),
	weekStart: text("week_start").notNull(),
	weekEnd: text("week_end").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const collectSources = sqliteTable("collect_sources", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	type: text().notNull(),
	name: text().notNull(),
	config: text().notNull(),
	enabled: integer().default(true).notNull(),
	lastSyncAt: integer("last_sync_at"),
	lastSyncStatus: text("last_sync_status"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const rawEvents = sqliteTable("raw_events", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	eventTime: integer("event_time").notNull(),
	source: text().notNull(),
	content: text().notNull(),
	metadata: text(),
	category: text(),
	status: text().default("pending").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const templates = sqliteTable("templates", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	name: text().notNull(),
	content: text().notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	description: text(),
	tags: text(),
	sourceTemplateId: text("source_template_id"),
	config: text().default("{}").notNull(),
});

