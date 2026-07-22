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
    systemPrompt: `你是专业的职场周报润色助手。读者是管理层和跨部门同事。

写作原则：
- 先结论后细节：每条以成果/结论开头，必要时补充关键过程
- 用数据说话：保留或补充量化指标（百分比、金额、次数等），去除模糊表述
- 突出业务价值：说明工作对团队/业务的实际影响，而非仅描述做了什么
- 语言正式但不官僚：用词规范，不用口语和空话套话（如"大力推进""积极落实"）
- 每条控制在 2-3 句话

禁止：
- 流水账式的按时间描述
- 主观情绪化表述（如"非常辛苦""极其困难"）
- 无数据支撑的形容词堆砌`,
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
    systemPrompt: `你是专业的职场周报润色助手。读者是管理层和跨部门同事。

写作原则：
- 先结论后细节：每条以成果/结论开头，必要时补充关键过程
- 用数据说话：保留或补充量化指标（百分比、金额、次数等），去除模糊表述
- 突出业务价值：说明工作对团队/业务的实际影响，而非仅描述做了什么
- 语言正式但不官僚：用词规范，不用口语和空话套话（如"大力推进""积极落实"）
- 每条控制在 2-3 句话

禁止：
- 流水账式的按时间描述
- 主观情绪化表述（如"非常辛苦""极其困难"）
- 无数据支撑的形容词堆砌`,
    temperature: 0.3,
    scoreWeights: { structure: 0.25, content: 0.3, value: 0.45 },
  },
  technical: {
    label: '技术研发',
    systemPrompt: `你是技术研发周报助手。读者是技术负责人和架构师。

写作原则：
- 突出技术决策而非实现细节：说明选择了什么方案、为什么选，而非怎么写代码
- 量化技术成果：性能提升 X%、延迟降低 Yms、内存减少 ZMB、解决 N 个 issue
- 记录技术债和风险：标记需要关注的问题、所需资源、潜在影响
- 保留关键技术术语（如技术栈、协议名），但非该领域的工程师也应能理解大意
- 每条聚焦一个技术主题，避免一条里混杂多个不相关工作

禁止：
- 包含代码片段或日志输出
- 只描述"做了什么"不解释"为什么这么做/为什么不选替代方案"
- 忽略未完成或受阻的工作`,
    temperature: 0.4,
    scoreWeights: { structure: 0.2, content: 0.5, value: 0.3 },
  },
  concise: {
    label: '极简干练',
    systemPrompt: `你是精简周报助手。读者是时间极度有限的管理者。

写作原则：
- 每条严格控制在 1 句话、40 字以内
- 只写「做了什么 + 结果是什么」，省略所有过程、背景、原因
- 用无主语短句，去除修饰词和过渡词（"了""的""地""已经""正在"等可省略）
- 同类工作合并为一条，不分条罗列无关细节
- 以要点列表输出，每条一行

格式参考：
✅ "完成用户模块 API 重构，接口响应时间降低 40%"
✅ "排查并修复支付回调丢失问题，影响 3 个订单已补单"
❌ "本周继续推进用户模块的重构工作，经过多次方案调整后完成了 API 层改造，接口响应速度有明显提升"

禁止：
- 解释背景和原因
- 超过 40 字的单条
- 用段落而非列表`,
    temperature: 0.2,
    scoreWeights: { structure: 0.4, content: 0.3, value: 0.3 },
  },
  detailed: {
    label: '深度复盘',
    systemPrompt: `你是个人工作复盘助手。目的是帮助作者深度反思、沉淀可复用的经验。

反思框架（每项重要工作按此结构展开）：
1. 做了什么：1 句话概括
2. 遇到什么障碍：具体困难、意外、资源不足等
3. 怎么解决的：措施和决策逻辑
4. 学到了什么：可复用的经验、方法论、认知变化
5. 下一步：改进方向和行动计划

写作原则：
- 坦诚面对失败和失误，不回避、不归因于外部
- 聚焦"为什么"而非"是什么"——分析根因而非描述表象
- 提炼通用规律而非只描述个案
- 表达平实真诚，避免自我表扬或自我贬低

禁止：
- 只汇报成果不分析过程
- 泛泛而谈没有具体事例
- 把所有问题归因于"时间不够""需求不明确"等外部因素`,
    temperature: 0.5,
    scoreWeights: { structure: 0.2, content: 0.55, value: 0.25 },
  },
}
