import { sqliteTable, AnySQLiteColumn, integer, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export type SectionType = 'achievement' | 'risk' | 'routine' | 'plan'

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
	enabled: integer({ mode: 'boolean' }).default(true).notNull(),
	lastSyncAt: integer("last_sync_at"),
	lastSyncStatus: text("last_sync_status"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const rawEvents = sqliteTable("raw_events", {
	id: integer("id").primaryKey({ autoIncrement: true }).notNull(),
	eventTime: integer("event_time", { mode: "timestamp" }).notNull(),
	source: text("source").notNull(),
	content: text("content").notNull(),
	metadata: text("metadata", { mode: "json" }),
	category: text("category"),
	sectionType: text("section_type").default("routine").notNull().$type<SectionType>(),
	status: text("status").default("pending").notNull(),
	isImportant: integer("is_important", { mode: "boolean" }).default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
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

