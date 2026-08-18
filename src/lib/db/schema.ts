import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export type ScoreStatus = 'pending' | 'scoring' | 'completed' | 'failed'
export type AudienceVariant = 'leadership' | 'personal'
export type FinalStatus = 'none' | 'current' | 'stale'
export type GenerationSessionStatus = 'active' | 'archived'
export type GenerationTurnStatus = 'working' | 'completed' | 'failed' | 'aborted'
export type GenerationMessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'application'
export type GenerationMessagePartType =
  | 'system-prompt'
  | 'style-prompt'
  | 'tool-rules'
  | 'source-overview'
  | 'text'
  | 'reasoning'
  | 'tool-call'
  | 'tool-result'
  | 'status'
  | 'error'
  | 'proposal-accepted'
export type GenerationProposalStatus = 'pending' | 'accepted' | 'superseded'

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  aiStyleOverride: text('ai_style_override').$type<AIStyle>(),
  scoreStatus: text('score_status').$type<ScoreStatus>().default('pending').notNull(),
  scoreStructure: integer('score_structure'),
  scoreContent: integer('score_content'),
  scoreValue: integer('score_value'),
  scoreOverall: integer('score_overall'),
  suggestions: text('suggestions'),
  scoreError: text('score_error'),
  scoredAt: integer('scored_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert

/**
 * A persisted audience-specific source draft and optional AI-generated final.
 * The legacy reports.content/score columns remain for reports created before
 * the dual-variant model was introduced.
 */
export const reportVariants = sqliteTable('report_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull(),
  variant: text('variant').notNull().$type<AudienceVariant>(),
  sourceDraft: text('source_draft').notNull(),
  finalContent: text('final_content'),
  finalStatus: text('final_status').notNull().default('none').$type<FinalStatus>(),
  templateId: text('template_id'),
  templateName: text('template_name'),
  templateContent: text('template_content'),
  aiStyle: text('ai_style').$type<AIStyle>(),
  acceptedProposalId: integer('accepted_proposal_id'),
  sourceRevision: integer('source_revision').notNull().default(1),
  scoreStatus: text('score_status').$type<ScoreStatus>().default('pending').notNull(),
  scoreStructure: integer('score_structure'),
  scoreContent: integer('score_content'),
  scoreValue: integer('score_value'),
  scoreOverall: integer('score_overall'),
  suggestions: text('suggestions'),
  scoreError: text('score_error'),
  scoredAt: integer('scored_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  reportVariantUnique: uniqueIndex('report_variants_report_variant_unique').on(table.reportId, table.variant),
}))

export type ReportVariant = typeof reportVariants.$inferSelect
export type NewReportVariant = typeof reportVariants.$inferInsert

/** Immutable event facts captured when a report's source drafts are created. */
export const reportEventSnapshots = sqliteTable('report_event_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull(),
  rawEventId: integer('raw_event_id'),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  projectScope: text('project_scope').$type<ProjectScope>(),
  leadershipIncluded: integer('leadership_included', { mode: 'boolean' }).notNull().default(false),
  personalIncluded: integer('personal_included', { mode: 'boolean' }).notNull().default(true),
  sourceRevision: integer('source_revision').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export type ReportEventSnapshot = typeof reportEventSnapshots.$inferSelect
export type NewReportEventSnapshot = typeof reportEventSnapshots.$inferInsert

/**
 * A durable, audience-specific AI conversation. Context that can change is
 * snapshotted so reopening a session never silently changes what the model saw.
 */
export const generationSessions = sqliteTable('generation_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull(),
  reportVariantId: integer('report_variant_id').notNull(),
  variant: text('variant').notNull().$type<AudienceVariant>(),
  title: text('title').notNull(),
  status: text('status').notNull().default('active').$type<GenerationSessionStatus>(),
  sourceRevision: integer('source_revision').notNull(),
  sourceDraftSnapshot: text('source_draft_snapshot').notNull(),
  sourceOverview: text('source_overview').notNull(),
  templateId: text('template_id').notNull(),
  templateName: text('template_name').notNull(),
  templateContent: text('template_content').notNull(),
  aiStyleKey: text('ai_style_key').notNull(),
  aiStyleLabel: text('ai_style_label').notNull(),
  aiStylePrompt: text('ai_style_prompt').notNull(),
  temperature: text('temperature').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  toolRules: text('tool_rules').notNull(),
  baselineFinalContent: text('baseline_final_content'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
})

export type GenerationSession = typeof generationSessions.$inferSelect
export type NewGenerationSession = typeof generationSessions.$inferInsert

/** One user request and the streamed assistant response it produced. */
export const generationTurns = sqliteTable('generation_turns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  status: text('status').notNull().default('working').$type<GenerationTurnStatus>(),
  protocol: text('protocol').notNull().$type<AIProtocol>(),
  model: text('model').notNull(),
  reasoningEffort: text('reasoning_effort'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
})

export type GenerationTurn = typeof generationTurns.$inferSelect
export type NewGenerationTurn = typeof generationTurns.$inferInsert

/** Append-only, displayable transcript parts. Streamed text is coalesced. */
export const generationMessageParts = sqliteTable('generation_message_parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  turnId: integer('turn_id'),
  sequence: integer('sequence').notNull(),
  role: text('role').notNull().$type<GenerationMessageRole>(),
  partType: text('part_type').notNull().$type<GenerationMessagePartType>(),
  content: text('content'),
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  sessionSequenceUnique: uniqueIndex('generation_message_parts_session_sequence_unique').on(table.sessionId, table.sequence),
}))

export type GenerationMessagePart = typeof generationMessageParts.$inferSelect
export type NewGenerationMessagePart = typeof generationMessageParts.$inferInsert

/** A complete Markdown candidate emitted only through propose_final_report. */
export const generationProposals = sqliteTable('generation_proposals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull(),
  turnId: integer('turn_id').notNull(),
  content: text('content').notNull(),
  summary: text('summary', { mode: 'json' }).notNull().$type<string[]>(),
  sourceRevision: integer('source_revision').notNull(),
  status: text('status').notNull().default('pending').$type<GenerationProposalStatus>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
})

export type GenerationProposal = typeof generationProposals.$inferSelect
export type NewGenerationProposal = typeof generationProposals.$inferInsert

/** @deprecated 改用 string，风格现在是数据库实体，不再硬编码 key */
export type AIStyle = string

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  aiStyle: text('ai_style').default('formal').notNull().$type<AIStyle>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert

export interface CollectSourceConfig {
  baseUrl?: string
  owner: string
  repo?: string
  token?: string
  authorEmails: string[]
  branches?: Array<string | { name: string; lastCommitTime?: string | null }>
  aliases?: string[]
}

export type CollectSourceStatus = 'enabled' | 'disabled' | 'unavailable'
export type ProjectScope = 'work' | 'personal'

export const collectSources = sqliteTable('collect_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).notNull().$type<CollectSourceConfig>(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  status: text('status').$type<CollectSourceStatus>().default('enabled'),
  projectScope: text('project_scope').notNull().default('personal').$type<ProjectScope>(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSyncStatus: text('last_sync_status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type CollectSource = typeof collectSources.$inferSelect
export type NewCollectSource = typeof collectSources.$inferInsert

export interface RawEventMetadata {
  sha?: string
  url?: string
  repo?: string
  branch?: string
  sourceId?: number
  sourceName?: string
  aliases?: string[]
}

export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  category: text('category'),
  isImportant: integer('is_important', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type RawEvent = typeof rawEvents.$inferSelect
export type NewRawEvent = typeof rawEvents.$inferInsert

export const sentenceSnippets = sqliteTable('sentence_snippets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  category: text('category').notNull().default('通用'),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type SentenceSnippet = typeof sentenceSnippets.$inferSelect
export type NewSentenceSnippet = typeof sentenceSnippets.$inferInsert

export type AIProtocol = 'openai' | 'openai-compatible' | 'anthropic'

export const aiConfig = sqliteTable('ai_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  protocol: text('protocol').notNull().default('openai-compatible').$type<AIProtocol>(),
  apiUrl: text('api_url').notNull(),
  apiKey: text('api_key').notNull(),
  model: text('model').notNull(),
  modelListCache: text('model_list_cache', { mode: 'json' }).$type<string[]>(),
  modelListCachedAt: integer('model_list_cached_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type AIConfig = typeof aiConfig.$inferSelect
export type NewAIConfig = typeof aiConfig.$inferInsert

// --- AI 风格表（CRUD） ---

export type DetailLevel = 'low' | 'medium' | 'high'
export type ResultOriented = 'low' | 'medium' | 'high'

export interface ScoreWeights {
  structure: number
  content: number
  value: number
}

export const aiStyles = sqliteTable('ai_styles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  temperature: text('temperature').notNull().default('0.3'),
  scoreStructureWeight: integer('score_structure_weight').notNull().default(25),
  scoreContentWeight: integer('score_content_weight').notNull().default(30),
  scoreValueWeight: integer('score_value_weight').notNull().default(45),
  detailLevel: text('detail_level').$type<DetailLevel>(),
  resultOriented: text('result_oriented').$type<ResultOriented>(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type AIStyleRow = typeof aiStyles.$inferSelect
export type NewAIStyleRow = typeof aiStyles.$inferInsert

// --- 系统提示词表（全局唯一，只可编辑） ---

export type SystemPromptKey = 'check' | 'score' | 'generate'

export const systemPrompts = sqliteTable('system_prompts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique().$type<SystemPromptKey>(),
  label: text('label').notNull(),
  promptText: text('prompt_text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type SystemPromptRow = typeof systemPrompts.$inferSelect
export type NewSystemPromptRow = typeof systemPrompts.$inferInsert
