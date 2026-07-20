import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/lib/db/schema'
import { getAIConfig, saveAIConfig, clearAIConfig, isAIConfigured } from './config'

function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE ai_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      protocol TEXT NOT NULL DEFAULT 'openai',
      api_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model TEXT NOT NULL,
      model_list_cache TEXT,
      model_list_cached_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  return drizzle(sqlite, { schema })
}

describe('AI Config', () => {
  let testDb: ReturnType<typeof createTestDb>

  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    const client = (testDb as unknown as { $client?: { close?: () => void } }).$client
    client?.close?.()
  })

  describe('isAIConfigured', () => {
    it('returns false when no config exists', async () => {
      expect(await isAIConfigured(testDb)).toBe(false)
    })

    it('returns true when config exists', async () => {
      await saveAIConfig(testDb, {
        protocol: 'openai',
        apiUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      })
      expect(await isAIConfigured(testDb)).toBe(true)
    })
  })

  describe('getAIConfig', () => {
    it('returns null when no config exists', async () => {
      expect(await getAIConfig(testDb)).toBeNull()
    })

    it('returns the config when it exists', async () => {
      await saveAIConfig(testDb, {
        protocol: 'openai',
        apiUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      })

      const config = await getAIConfig(testDb)
      expect(config).not.toBeNull()
      expect(config!.protocol).toBe('openai')
      expect(config!.apiUrl).toBe('https://api.example.com/v1')
      expect(config!.apiKey).toBe('test-key')
      expect(config!.model).toBe('gpt-4o-mini')
    })
  })

  describe('saveAIConfig', () => {
    it('creates config when none exists', async () => {
      await saveAIConfig(testDb, {
        protocol: 'anthropic',
        apiUrl: 'https://api.anthropic.com',
        apiKey: 'ant-key',
        model: 'claude-sonnet-4-20250514',
      })

      const config = await getAIConfig(testDb)
      expect(config).not.toBeNull()
      expect(config!.protocol).toBe('anthropic')
      expect(config!.apiUrl).toBe('https://api.anthropic.com')
    })

    it('updates existing config (upsert)', async () => {
      await saveAIConfig(testDb, {
        protocol: 'openai',
        apiUrl: 'https://api.example.com/v1',
        apiKey: 'key1',
        model: 'gpt-4o-mini',
      })

      await saveAIConfig(testDb, {
        protocol: 'openai',
        apiUrl: 'https://api.example.com/v2',
        apiKey: 'key2',
        model: 'gpt-4o',
      })

      const config = await getAIConfig(testDb)
      expect(config!.apiUrl).toBe('https://api.example.com/v2')
      expect(config!.apiKey).toBe('key2')
      expect(config!.model).toBe('gpt-4o')
    })

    it('defaults protocol to openai', async () => {
      await saveAIConfig(testDb, {
        apiUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      })

      const config = await getAIConfig(testDb)
      expect(config!.protocol).toBe('openai')
    })
  })

  describe('clearAIConfig', () => {
    it('removes config', async () => {
      await saveAIConfig(testDb, {
        apiUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
      })

      expect(await isAIConfigured(testDb)).toBe(true)
      await clearAIConfig(testDb)
      expect(await isAIConfigured(testDb)).toBe(false)
    })

    it('is safe to call when no config exists', async () => {
      await expect(clearAIConfig(testDb)).resolves.not.toThrow()
    })
  })
})
