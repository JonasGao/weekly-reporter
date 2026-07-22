import { getDb } from '../db'
import { aiStyles, systemPrompts } from '../db/schema'
import { sql } from 'drizzle-orm'

const CREATE_AI_STYLES = `
CREATE TABLE IF NOT EXISTS ai_styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature TEXT NOT NULL DEFAULT '0.3',
  score_structure_weight INTEGER NOT NULL DEFAULT 25,
  score_content_weight INTEGER NOT NULL DEFAULT 30,
  score_value_weight INTEGER NOT NULL DEFAULT 45,
  detail_level TEXT,
  result_oriented TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`

const CREATE_SYSTEM_PROMPTS = `
CREATE TABLE IF NOT EXISTS system_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`

const BUILTIN_STYLES = [
  {
    key: 'formal',
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
    temperature: '0.3',
    scoreStructureWeight: 25,
    scoreContentWeight: 30,
    scoreValueWeight: 45,
    isDefault: true,
  },
  {
    key: 'technical',
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
    temperature: '0.4',
    scoreStructureWeight: 20,
    scoreContentWeight: 50,
    scoreValueWeight: 30,
    isDefault: false,
  },
  {
    key: 'concise',
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
    temperature: '0.2',
    scoreStructureWeight: 40,
    scoreContentWeight: 30,
    scoreValueWeight: 30,
    isDefault: false,
  },
  {
    key: 'detailed',
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

/** 确保表和默认数据存在（幂等） */
export async function ensureSeed(): Promise<void> {
  if (seeded) return

  const db = getDb()
  const now = new Date()

  // 先确保表存在（不依赖 migrate，直接建表）
  await ensureTables(db)

  // Seed AI styles if empty
  try {
    const styleCount = await db.select({ count: sql<number>`count(*)` }).from(aiStyles)
    if ((styleCount[0]?.count ?? 0) === 0) {
      for (const style of BUILTIN_STYLES) {
        await db.insert(aiStyles).values({ ...style, createdAt: now, updatedAt: now })
      }
    }
  } catch (e) {
    console.error('[seed] Failed to seed ai_styles:', e instanceof Error ? e.message : e)
  }

  // Seed system prompts if empty
  try {
    const promptCount = await db.select({ count: sql<number>`count(*)` }).from(systemPrompts)
    if ((promptCount[0]?.count ?? 0) === 0) {
      for (const prompt of BUILTIN_SYSTEM_PROMPTS) {
        await db.insert(systemPrompts).values({ ...prompt, createdAt: now, updatedAt: now })
      }
    }
  } catch (e) {
    console.error('[seed] Failed to seed system_prompts:', e instanceof Error ? e.message : e)
  }

  seeded = true
}

/** 直接用 better-sqlite3 建表，绕过 migration 链路 */
function ensureTables(db: ReturnType<typeof getDb>): void {
  try {
    // drizzle better-sqlite3 实例包含原始 better-sqlite3 Database 引用
    const dbAny = db as unknown as { $client: { exec(sql: string): void } }
    if (dbAny.$client) {
      dbAny.$client.exec(CREATE_AI_STYLES)
      dbAny.$client.exec(CREATE_SYSTEM_PROMPTS)
    }
  } catch (e) {
    console.error('[seed] Failed to ensure tables:', e instanceof Error ? e.message : e)
  }
}
