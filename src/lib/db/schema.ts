import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export type ScoreStatus = 'pending' | 'scoring' | 'completed' | 'failed'

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

export type SectionType = 'achievement' | 'risk' | 'routine' | 'plan'
/** @deprecated 改用 string，风格现在是数据库实体，不再硬编码 key */
export type AIStyle = string

export interface SectionRenderConfig {
  maxItems?: number
  autoSort?: boolean
  filterTrivial?: boolean
}

export interface ViewConfig {
  enabledSections: string[]
  sectionConfig: Record<string, SectionRenderConfig>
  aiStyle: AIStyle
}

export interface TemplateConfig {
  sectionSkeleton?: {
    type: 'unordered' | 'ordered' | 'task'
    placeholderCount: number
  }
  sectionConfig?: {
    achievement?: SectionRenderConfig
    risk?: SectionRenderConfig
    routine?: SectionRenderConfig
    plan?: SectionRenderConfig
  }
  sectionTypeMap?: Record<string, SectionType>
  viewConfigs?: {
    leadership?: ViewConfig
    personal?: ViewConfig
  }
}

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  sectionType: text('section_type').$type<SectionType>(),
  color: text('color'),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  aiStyle: text('ai_style').default('formal').notNull().$type<AIStyle>(),
  config: text('config', { mode: 'json' }).notNull().default({}),
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
  sectionType: text('section_type').default('routine').notNull().$type<SectionType>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
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

export type SystemPromptKey = 'check' | 'score'

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