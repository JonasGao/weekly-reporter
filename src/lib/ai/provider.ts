import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'
import type { AIConfig } from '@/lib/db/schema'

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIConfigError'
  }
}

export function createModelFromConfig(config: AIConfig): LanguageModel {
  if (config.protocol === 'anthropic') {
    const anthropic = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.apiUrl || undefined,
    })
    return anthropic(config.model)
  }

  const openai = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.apiUrl,
  })

  // OpenAI Compatible uses chat() for APIs that only support Chat Completions API
  if (config.protocol === 'openai-compatible') {
    return openai.chat(config.model)
  }

  // OpenAI official uses default Responses API
  return openai(config.model)
}

export async function fetchModelList(config: AIConfig): Promise<string[]> {
  if (config.protocol === 'anthropic') {
    return []
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const url = config.apiUrl.replace(/\/+$/, '') + '/models'
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const models = data.data?.map((m: { id: string }) => m.id) ?? []
    return models.sort()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function testConnection(config: AIConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const model = createModelFromConfig(config)
    const { generateText } = await import('ai')
    await generateText({
      model,
      prompt: 'Hi',
      maxOutputTokens: 5,
    })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}
