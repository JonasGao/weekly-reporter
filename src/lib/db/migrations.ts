import fs from 'node:fs'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readMigrationFiles, type MigrationMeta } from 'drizzle-orm/migrator'

const LEGACY_MIGRATIONS = [
  '0017_add_report_scoring',
  '0018_small_spot',
  '0019_romantic_matthew_murdock',
] as const

const REPORT_SCORING_COLUMNS = [
  'score_status',
  'score_structure',
  'score_content',
  'score_value',
  'score_overall',
  'suggestions',
  'score_error',
  'scored_at',
]

const AI_CONFIG_COLUMNS = [
  'id',
  'protocol',
  'api_url',
  'api_key',
  'model',
  'model_list_cache',
  'model_list_cached_at',
  'created_at',
  'updated_at',
]

const AI_STYLE_COLUMNS = [
  'id',
  'key',
  'label',
  'system_prompt',
  'temperature',
  'score_structure_weight',
  'score_content_weight',
  'score_value_weight',
  'detail_level',
  'result_oriented',
  'is_default',
  'created_at',
  'updated_at',
]

const SYSTEM_PROMPT_COLUMNS = ['id', 'key', 'label', 'prompt_text', 'created_at', 'updated_at']

function tableExists(sqlite: Database.Database, table: string): boolean {
  return Boolean(sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).get(table))
}

function columns(sqlite: Database.Database, table: string): string[] {
  if (!tableExists(sqlite, table)) return []
  return sqlite.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all()
    .map((row) => (row as { name: string }).name)
}

function hasColumns(sqlite: Database.Database, table: string, expected: string[]): boolean {
  const actual = new Set(columns(sqlite, table))
  return expected.every((column) => actual.has(column))
}

function hasExactColumns(sqlite: Database.Database, table: string, expected: string[]): boolean {
  const actual = columns(sqlite, table)
  return actual.length === expected.length && hasColumns(sqlite, table, expected)
}

function hasUniqueColumnIndex(sqlite: Database.Database, table: string, column: string): boolean {
  if (!tableExists(sqlite, table)) return false
  return sqlite.prepare(`PRAGMA index_list(${JSON.stringify(table)})`).all()
    .some((index) => {
      const row = index as { name: string; unique: number }
      if (row.unique !== 1) return false
      const indexedColumns = sqlite.prepare(`PRAGMA index_info(${JSON.stringify(row.name)})`).all()
      return indexedColumns.length === 1 && (indexedColumns[0] as { name: string }).name === column
    })
}

function migrationByName(
  migrations: MigrationMeta[],
  migrationsFolder: string,
  name: string,
): MigrationMeta {
  const file = fs.readFileSync(`${migrationsFolder}/${name}.sql`)
  const hash = crypto.createHash('sha256').update(file).digest('hex')
  const migration = migrations.find((item) => item.hash === hash)
  if (!migration) {
    throw new Error(`Migration ${name} is missing from the migration folder`)
  }
  return migration
}

function markMigration(sqlite: Database.Database, migration: MigrationMeta): void {
  sqlite.prepare(
    'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
  ).run(migration.hash, migration.folderMillis)
}

function hasMigration(sqlite: Database.Database, migration: MigrationMeta): boolean {
  return Boolean(sqlite.prepare(
    'SELECT 1 FROM __drizzle_migrations WHERE hash = ? OR created_at = ? LIMIT 1',
  ).get(migration.hash, migration.folderMillis))
}

function reconcileAiConfigMigration(sqlite: Database.Database, migration: MigrationMeta): void {
  if (!hasExactColumns(sqlite, 'ai_config', AI_CONFIG_COLUMNS)) {
    throw new Error('Migration 0018 is partially applied: ai_config schema is incomplete')
  }
  if (!tableExists(sqlite, 'collect_sources')) {
    throw new Error('Migration 0018 cannot be reconciled: collect_sources is missing')
  }

  const protocol = sqlite.prepare(
    "SELECT dflt_value AS defaultValue FROM pragma_table_info('ai_config') WHERE name = 'protocol'",
  ).get() as { defaultValue: string | null } | undefined
  const projectScopeExists = columns(sqlite, 'collect_sources').includes('project_scope')

  sqlite.transaction(() => {
    if (protocol?.defaultValue !== "'openai-compatible'") {
      sqlite.exec(`
        CREATE TABLE __weekly_reporter_ai_config_repair (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          protocol TEXT DEFAULT 'openai-compatible' NOT NULL,
          api_url TEXT NOT NULL,
          api_key TEXT NOT NULL,
          model TEXT NOT NULL,
          model_list_cache TEXT,
          model_list_cached_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        INSERT INTO __weekly_reporter_ai_config_repair (
          id, protocol, api_url, api_key, model, model_list_cache,
          model_list_cached_at, created_at, updated_at
        )
        SELECT
          id, protocol, api_url, api_key, model, model_list_cache,
          model_list_cached_at, created_at, updated_at
        FROM ai_config;
        DROP TABLE ai_config;
        ALTER TABLE __weekly_reporter_ai_config_repair RENAME TO ai_config;
      `)
    }
    if (!projectScopeExists) {
      sqlite.exec("ALTER TABLE collect_sources ADD project_scope TEXT DEFAULT 'personal' NOT NULL")
    }
    markMigration(sqlite, migration)
  })()
}

function reconcileLegacyMigrations(
  sqlite: Database.Database,
  migrations: MigrationMeta[],
  migrationsFolder: string,
): void {
  if (!tableExists(sqlite, '__drizzle_migrations')) {
    return
  }

  const scoring = migrationByName(migrations, migrationsFolder, LEGACY_MIGRATIONS[0])
  if (!hasMigration(sqlite, scoring)) {
    if (!tableExists(sqlite, 'reports')) return
    if (!hasColumns(sqlite, 'reports', REPORT_SCORING_COLUMNS)) {
      throw new Error('Migration 0017 is partially applied: reports scoring columns are incomplete')
    }
    markMigration(sqlite, scoring)
  }

  const aiConfigMigration = migrationByName(migrations, migrationsFolder, LEGACY_MIGRATIONS[1])
  if (!hasMigration(sqlite, aiConfigMigration)) {
    reconcileAiConfigMigration(sqlite, aiConfigMigration)
  }

  const promptsMigration = migrationByName(migrations, migrationsFolder, LEGACY_MIGRATIONS[2])
  if (!hasMigration(sqlite, promptsMigration)) {
    const stylesComplete = hasColumns(sqlite, 'ai_styles', AI_STYLE_COLUMNS) && hasUniqueColumnIndex(sqlite, 'ai_styles', 'key')
    const promptsComplete = hasColumns(sqlite, 'system_prompts', SYSTEM_PROMPT_COLUMNS) && hasUniqueColumnIndex(sqlite, 'system_prompts', 'key')
    if (!tableExists(sqlite, 'ai_styles') && !tableExists(sqlite, 'system_prompts')) return
    if (!stylesComplete || !promptsComplete) {
      throw new Error('Migration 0019 is partially applied: prompt tables are incomplete')
    }
    markMigration(sqlite, promptsMigration)
  }
}

export function applyDatabaseMigrations(sqlite: Database.Database, migrationsFolder: string): void {
  const migrations = readMigrationFiles({ migrationsFolder })
  sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  )`)
  reconcileLegacyMigrations(sqlite, migrations, migrationsFolder)
  migrate(drizzle(sqlite), { migrationsFolder })
}
