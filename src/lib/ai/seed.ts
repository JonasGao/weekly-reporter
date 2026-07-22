import { getDb } from '../db'
import { aiStyles, systemPrompts } from '../db/schema'
import { sql } from 'drizzle-orm'

const BUILTIN_STYLES = [
  {
    key: 'formal',
    label: '正式汇报',
    systemPrompt: '你是专业的职场周报润色助手，表达正式严谨，突出成果价值，语言精炼专业。',
    temperature: '0.3',
    scoreStructureWeight: 25,
    scoreContentWeight: 30,
    scoreValueWeight: 45,
    isDefault: true,
  },
  {
    key: 'technical',
    label: '技术研发',
    systemPrompt: '你是技术研发周报助手，表述专业准确，保留技术细节，突出问题解决与技术沉淀。',
    temperature: '0.4',
    scoreStructureWeight: 20,
    scoreContentWeight: 50,
    scoreValueWeight: 30,
    isDefault: false,
  },
  {
    key: 'concise',
    label: '极简干练',
    systemPrompt: '你是精简周报助手，用短句表达，去掉冗余修饰，只保留核心信息。',
    temperature: '0.2',
    scoreStructureWeight: 40,
    scoreContentWeight: 30,
    scoreValueWeight: 30,
    isDefault: false,
  },
  {
    key: 'detailed',
    label: '深度复盘',
    systemPrompt: '你是个人工作复盘助手，侧重问题分析、经验沉淀、成长总结，表达平实详细。',
    temperature: '0.5',
    scoreStructureWeight: 20,
    scoreContentWeight: 55,
    scoreValueWeight: 25,
    isDefault: false,
  },
]

const BUILTIN_SYSTEM_PROMPTS = [
  {
    key: 'check' as const,
    label: '写作建议',
    promptText: `你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
{{content}}

{{#section}}当前区块：{{section}}{{/section}}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字）。
如果内容很好，返回空数组 []。`,
  },
  {
    key: 'score' as const,
    label: '周报评分',
    promptText: `你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
{{content}}

请从以下维度评分（0-100）：
1. structure（结构完整度）：各区块是否填写完整
2. content（内容充实度）：是否有具体细节和数据
3. value（价值突出度）：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议（每条不超过30字）
3. （可选）改写示例`,
  },
]

let seeded = false

/** 确保默认数据已插入（幂等，只在表为空时执行） */
export async function ensureSeed(): Promise<void> {
  if (seeded) return

  const db = getDb()
  const now = new Date()

  // Seed AI styles if empty
  const styleCount = await db.select({ count: sql<number>`count(*)` }).from(aiStyles)
  if ((styleCount[0]?.count ?? 0) === 0) {
    for (const style of BUILTIN_STYLES) {
      await db.insert(aiStyles).values({
        ...style,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Seed system prompts if empty
  const promptCount = await db.select({ count: sql<number>`count(*)` }).from(systemPrompts)
  if ((promptCount[0]?.count ?? 0) === 0) {
    for (const prompt of BUILTIN_SYSTEM_PROMPTS) {
      await db.insert(systemPrompts).values({
        ...prompt,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  seeded = true
}
