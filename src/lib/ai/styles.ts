import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { aiStyles as aiStylesTable, ScoreWeights } from '../db/schema'
import type { AIStyleRow } from '../db/schema'
import { ensureSeed } from './seed'

export interface AIStyleConfig {
  label: string
  systemPrompt: string
  temperature: number
  scoreWeights: {
    structure: number
    content: number
    value: number
  }
  detailLevel?: 'low' | 'medium' | 'high'
  resultOriented?: 'low' | 'medium' | 'high'
}

/** 将数据库行转换为 AIStyleConfig */
function rowToConfig(row: AIStyleRow): AIStyleConfig {
  const total = row.scoreStructureWeight + row.scoreContentWeight + row.scoreValueWeight || 100
  return {
    label: row.label,
    systemPrompt: row.systemPrompt,
    temperature: parseFloat(row.temperature),
    scoreWeights: {
      structure: row.scoreStructureWeight / total,
      content: row.scoreContentWeight / total,
      value: row.scoreValueWeight / total,
    },
    detailLevel: row.detailLevel ?? undefined,
    resultOriented: row.resultOriented ?? undefined,
  }
}

/**
 * 获取 AI 风格配置
 * 优先按 key 查找，找不到则回退到默认风格
 */
export async function getAIStyle(styleKey?: string): Promise<AIStyleConfig> {
  await ensureSeed()
  const db = getDb()

  if (styleKey) {
    const row = await db.query.aiStyles.findFirst({
      where: eq(aiStylesTable.key, styleKey),
    })
    if (row) return rowToConfig(row)
  }

  // 回退到默认风格
  const defaultRow = await db.query.aiStyles.findFirst({
    where: eq(aiStylesTable.isDefault, true),
  })
  if (defaultRow) return rowToConfig(defaultRow)

  // 最后的最后：如果数据库里什么也没有（迁移后还未 seed），返回硬编码兜底
  return {
    label: '正式汇报',
    systemPrompt: '你是专业的职场周报润色助手，表达正式严谨，突出成果价值，语言精炼专业。',
    temperature: 0.3,
    scoreWeights: { structure: 0.25, content: 0.3, value: 0.45 },
  }
}

export async function getStyleLabel(styleKey: string): Promise<string> {
  const config = await getAIStyle(styleKey)
  return config.label
}

/**
 * 获取所有 AI 风格列表
 */
export async function listAIStyles(): Promise<Array<AIStyleRow & { config: AIStyleConfig }>> {
  const db = getDb()
  const rows = await db.select().from(aiStylesTable).orderBy(aiStylesTable.createdAt)
  return rows.map(row => ({ ...row, config: rowToConfig(row) }))
}

/**
 * 创建 AI 风格
 */
export async function createAIStyle(input: {
  key: string
  label: string
  systemPrompt: string
  temperature?: number
  scoreStructureWeight?: number
  scoreContentWeight?: number
  scoreValueWeight?: number
  detailLevel?: 'low' | 'medium' | 'high' | null
  resultOriented?: 'low' | 'medium' | 'high' | null
  isDefault?: boolean
}): Promise<AIStyleRow> {
  const db = getDb()
  const now = new Date()

  const result = await db.insert(aiStylesTable).values({
    key: input.key,
    label: input.label,
    systemPrompt: input.systemPrompt,
    temperature: String(input.temperature ?? 0.3),
    scoreStructureWeight: input.scoreStructureWeight ?? 25,
    scoreContentWeight: input.scoreContentWeight ?? 30,
    scoreValueWeight: input.scoreValueWeight ?? 45,
    detailLevel: input.detailLevel ?? null,
    resultOriented: input.resultOriented ?? null,
    isDefault: input.isDefault ?? false,
    createdAt: now,
    updatedAt: now,
  }).returning()

  return result[0]
}

/**
 * 更新 AI 风格
 */
export async function updateAIStyle(
  id: number,
  input: Partial<{
    key: string
    label: string
    systemPrompt: string
    temperature: number
    scoreStructureWeight: number
    scoreContentWeight: number
    scoreValueWeight: number
    detailLevel: 'low' | 'medium' | 'high' | null
    resultOriented: 'low' | 'medium' | 'high' | null
    isDefault: boolean
  }>,
): Promise<AIStyleRow | null> {
  const db = getDb()
  const now = new Date()

  const existing = await db.select().from(aiStylesTable).where(eq(aiStylesTable.id, id))
  if (existing.length === 0) return null

  await db.update(aiStylesTable)
    .set({
      key: input.key ?? existing[0].key,
      label: input.label ?? existing[0].label,
      systemPrompt: input.systemPrompt ?? existing[0].systemPrompt,
      temperature: input.temperature !== undefined ? String(input.temperature) : existing[0].temperature,
      scoreStructureWeight: input.scoreStructureWeight ?? existing[0].scoreStructureWeight,
      scoreContentWeight: input.scoreContentWeight ?? existing[0].scoreContentWeight,
      scoreValueWeight: input.scoreValueWeight ?? existing[0].scoreValueWeight,
      detailLevel: input.detailLevel !== undefined ? input.detailLevel : existing[0].detailLevel,
      resultOriented: input.resultOriented !== undefined ? input.resultOriented : existing[0].resultOriented,
      isDefault: input.isDefault ?? existing[0].isDefault,
      updatedAt: now,
    })
    .where(eq(aiStylesTable.id, id))

  const updated = await db.select().from(aiStylesTable).where(eq(aiStylesTable.id, id))
  return updated[0]
}

/**
 * 删除 AI 风格
 * - 最后一个风格禁止删除
 * - 默认风格禁止删除（需先转移默认标记）
 * - 删除后清除引用此风格的报告的 aiStyleOverride
 */
export async function deleteAIStyle(id: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb()

  const existing = await db.select().from(aiStylesTable).where(eq(aiStylesTable.id, id))
  if (existing.length === 0) {
    return { success: false, error: '风格不存在' }
  }

  const style = existing[0]

  // 检查是否是最后一个风格
  const count = await db.select({ count: sql<number>`count(*)` }).from(aiStylesTable)
  if ((count[0]?.count ?? 0) <= 1) {
    return { success: false, error: '无法删除最后一个风格' }
  }

  // 检查是否是默认风格
  if (style.isDefault) {
    return { success: false, error: '默认风格不能删除，请先将其他风格设为默认' }
  }

  // 清除引用此风格的报告的 aiStyleOverride
  const { reports } = await import('../db/schema')
  await db.update(reports)
    .set({ aiStyleOverride: null })
    .where(eq(reports.aiStyleOverride, style.key))

  // 删除风格
  await db.delete(aiStylesTable).where(eq(aiStylesTable.id, id))

  return { success: true }
}

/**
 * 设置默认风格（将指定风格标记为默认，取消其他默认标记）
 */
export async function setDefaultStyle(id: number): Promise<AIStyleRow | null> {
  const db = getDb()
  const now = new Date()

  const existing = await db.select().from(aiStylesTable).where(eq(aiStylesTable.id, id))
  if (existing.length === 0) return null

  // 取消所有默认标记
  await db.update(aiStylesTable).set({ isDefault: false, updatedAt: now })

  // 设置新默认
  await db.update(aiStylesTable).set({ isDefault: true, updatedAt: now }).where(eq(aiStylesTable.id, id))

  const updated = await db.select().from(aiStylesTable).where(eq(aiStylesTable.id, id))
  return updated[0]
}

/** @deprecated 仅用于 seed 数据，运行时请使用 getAIStyle() */
export const aiStyles: Record<string, AIStyleConfig> = {
  formal: {
    label: '正式汇报',
    systemPrompt: '你是专业的职场周报润色助手，表达正式严谨，突出成果价值，语言精炼专业。',
    temperature: 0.3,
    scoreWeights: { structure: 0.25, content: 0.3, value: 0.45 },
  },
  technical: {
    label: '技术研发',
    systemPrompt: '你是技术研发周报助手，表述专业准确，保留技术细节，突出问题解决与技术沉淀。',
    temperature: 0.4,
    scoreWeights: { structure: 0.2, content: 0.5, value: 0.3 },
  },
  concise: {
    label: '极简干练',
    systemPrompt: '你是精简周报助手，用短句表达，去掉冗余修饰，只保留核心信息。',
    temperature: 0.2,
    scoreWeights: { structure: 0.4, content: 0.3, value: 0.3 },
  },
  detailed: {
    label: '深度复盘',
    systemPrompt: '你是个人工作复盘助手，侧重问题分析、经验沉淀、成长总结，表达平实详细。',
    temperature: 0.5,
    scoreWeights: { structure: 0.2, content: 0.55, value: 0.25 },
  },
}
