import { generateObject } from 'ai'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { systemPrompts } from '@/lib/db/schema'
import { getAIConfig } from './ai/config'
import { createModelFromConfig, AIConfigError } from './ai/provider'

/** 获取系统提示词模板 */
async function getSystemPrompt(key: 'check' | 'score'): Promise<string> {
  const db = getDb()
  const row = await db.query.systemPrompts.findFirst({
    where: eq(systemPrompts.key, key),
  })
  if (row) return row.promptText

  // 兜底：返回硬编码默认值
  if (key === 'check') {
    return `你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
{{content}}

{{#section}}当前区块：{{section}}{{/section}}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字）。
如果内容很好，返回空数组 []。`
  }
  // score
  return `你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
{{content}}

请从以下维度评分（0-100）：
1. structure（结构完整度）：各区块是否填写完整
2. content（内容充实度）：是否有具体细节和数据
3. value（价值突出度）：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议（每条不超过30字）
3. （可选）改写示例`
}

/** 简单的 Mustache 风格模板替换：{{var}} 或 {{#var}}...{{/var}} */
function renderPromptTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  // 先处理条件块 {{#var}}...{{/var}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : ''
  })
  // 再处理简单变量 {{var}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] ?? `{{${key}}}`
  })
  return result
}

export interface CheckRequest {
  content: string
  section?: string
}

export interface CheckResponse {
  suggestions: string[]
  score?: number
}

export interface ScoreRequest {
  content: string
}

export interface ScoreResponse {
  score: {
    structure: number
    content: number
    value: number
    overall: number
  }
  suggestions: string[]
  rewriteExamples?: {
    original: string
    improved: string
  }[]
}

async function getModel() {
  const db = getDb()
  const config = await getAIConfig(db)
  if (!config) {
    throw new AIConfigError('AI_API_KEY 未配置')
  }
  return createModelFromConfig(config)
}

export async function checkContent(request: CheckRequest): Promise<CheckResponse> {
  const template = await getSystemPrompt('check')
  const prompt = renderPromptTemplate(template, {
    content: request.content,
    section: request.section || '',
  })

  try {
    const model = await getModel()
    const { object } = await generateObject({
      model,
      schema: z.object({
        suggestions: z.array(z.string()),
      }),
      prompt,
      temperature: 0.7,
    })

    return { suggestions: object.suggestions }
  } catch (error) {
    if (error instanceof AIConfigError) {
      return { suggestions: [error.message] }
    }
    console.error('checkContent error:', error)
    return { suggestions: [] }
  }
}

export async function scoreReport(request: ScoreRequest): Promise<ScoreResponse> {
  const template = await getSystemPrompt('score')
  const prompt = renderPromptTemplate(template, {
    content: request.content,
  })

  try {
    const model = await getModel()
    const { object } = await generateObject({
      model,
      schema: z.object({
        score: z.object({
          structure: z.number(),
          content: z.number(),
          value: z.number(),
          overall: z.number(),
        }),
        suggestions: z.array(z.string()),
        rewriteExamples: z.array(z.object({
          original: z.string(),
          improved: z.string(),
        })).optional(),
      }),
      prompt,
      temperature: 0.7,
    })

    return {
      score: object.score,
      suggestions: object.suggestions,
      rewriteExamples: object.rewriteExamples,
    }
  } catch (error) {
    if (error instanceof AIConfigError) {
      return {
        score: { structure: 0, content: 0, value: 0, overall: 0 },
        suggestions: [error.message],
      }
    }
    console.error('scoreReport error:', error)
    return {
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['AI 服务暂时不可用'],
    }
  }
}

export async function polishEvent(
  content: string,
  systemPrompt: string,
  temperature: number,
): Promise<string> {
  const model = await getModel()
  const { object } = await generateObject({
    model,
    schema: z.object({ polishedContent: z.string() }),
    prompt: `${systemPrompt}\n\n请润色以下内容：\n${content}`,
    temperature,
  })
  return object.polishedContent
}

export async function expandSection(
  sectionTitle: string,
  existingItems: string[],
  events: string[],
  systemPrompt: string,
  temperature: number,
): Promise<Array<{ content: string; source: 'existing' | 'generated' }>> {
  const model = await getModel()
  const { object } = await generateObject({
    model,
    schema: z.object({
      newItems: z.array(z.string()),
    }),
    prompt: `${systemPrompt}\n\n章节标题：${sectionTitle}\n\n已有条目：\n${existingItems.join('\n')}\n\n可用事件素材：\n${events.join('\n')}\n\n请基于事件素材生成新的条目来补充这个章节。`,
    temperature,
  })

  const results: Array<{ content: string; source: 'existing' | 'generated' }> = existingItems.map(item => ({
    content: item,
    source: 'existing' as const,
  }))

  for (const item of object.newItems) {
    results.push({ content: item, source: 'generated' as const })
  }

  return results
}

export async function unifyStyle(
  content: string,
  systemPrompt: string,
  temperature: number,
): Promise<{ unifiedContent: string; changesCount: number }> {
  const model = await getModel()
  const { object } = await generateObject({
    model,
    schema: z.object({
      unifiedContent: z.string(),
      changesCount: z.number(),
    }),
    prompt: `${systemPrompt}\n\n请统一以下内容的写作风格：\n${content}`,
    temperature,
  })

  return {
    unifiedContent: object.unifiedContent,
    changesCount: object.changesCount,
  }
}
