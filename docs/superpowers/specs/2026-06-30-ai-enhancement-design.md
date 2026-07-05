# 模板AI增强体系与句式片段模板库设计文档

## 项目概述

在P0/P1/P2阶段完成后，本阶段（P3）开发模板AI增强体系与句式片段模板库，为周报编辑提供智能润色和表达辅助能力。

## 核心需求

**1. 模板绑定AI风格策略**
- 正式模板：专业、成果化、精简、价值导向
- 复盘模板：细节丰富、侧重沉淀、问题分析
- 极简模板：短句、干练、结构化
- 技术研发模板：专业准确、保留技术细节

**2. 复用现有OpenAI能力，新增三项AI功能**
- 单条事件AI成果化润色
- 区块AI自动扩写补全
- 全文根据模板风格一键统一语调

**3. 新增句式片段模板库**
- 可自定义新增句式
- 编辑器侧边栏快速插入
- 分类：成果句式、问题句式、计划句式、量化句式
- 数据库持久化存储

**4. AI评分逻辑适配**
- 不同模板类型使用不同的评分权重
- 评分标准动态变化，体现模板风格差异

## 设计约束

- 完全复用已有AI请求封装（底层OpenAI调用）
- 不新增第三方API
- 底层预留扩展能力（结构化配置）
- 前端侧边栏轻量管理，不做独立管理页面

## 关键设计决策记录

| 决策点 | 选择方案 | 原因 |
|--------|---------|------|
| AI风格策略存储方式 | 模板携带风格参数 + 用户可覆盖 | 既有模板默认风格，又保持周报编辑灵活性 |
| AI风格参数定义 | 简单风格标签 + 底层预留结构化扩展 | P3阶段快速落地，预留未来升级能力 |
| 句式片段库管理 | 数据库表存储 + 侧边栏轻量增删 | 数据持久可靠，开发成本低，体验顺滑 |
| AI评分适配方式 | 权重动态调整 + 底层预留完整Prompt扩展 | 零重构风险，复用现有体系，效果足够明显 |
| 预置句式处理 | 官方预置20-30条 + 用户可沉淀自定义 | 冷启动内容丰富，长期积累贴合个人表达习惯 |
| AI接口设计 | 复用底层封装 + 新增业务接口层 | 不重构基础能力，只扩展业务场景和Prompt |

### AI能力现状与扩展策略

**现有能力**：
- `/api/reports/check` 接口已实现内容检查、评分、改写建议
- 底层OpenAI调用封装完整（请求参数、鉴权、错误处理、返回解析）
- 与编辑器场景强耦合

**P3扩展方向**：
- 新增业务接口：润色、扩写、统一改写
- 新增Prompt体系：适配不同模板风格
- 保持底层调用封装不变，只扩展业务层

## 技术栈

| 技术 | 用途 | 状态 |
|------|------|------|
| Next.js 16 | 框架 (App Router) | 已存在 |
| Drizzle ORM | 数据库 ORM | 已存在 |
| SQLite | 数据库 | 已存在 |
| Milkdown | Markdown 编辑器 | 已存在 |
| shadcn/ui | UI 组件库 | 已存在 |
| Tailwind CSS | 样式框架 | 已存在 |
| OpenAI API | AI 能力 | 已封装 |

## 数据模型设计

### 1. 句式片段表（新增）

```typescript
export const sentenceSnippets = sqliteTable('sentence_snippets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
  category: text('category').notNull().default('通用'),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
})

export type SentenceSnippet = typeof sentenceSnippets.$inferSelect
export type NewSentenceSnippet = typeof sentenceSnippets.$inferInsert
```

**字段说明：**
- `content`：句式内容（Markdown格式）
- `category`：固定4种分类（成果/问题/计划/量化）
- `isBuiltIn`：标记官方预置句式（不可删除，只可隐藏）
- 与周报区块对齐，不做复杂分类管理

### 2. 模板表扩展（修改现有表）

```typescript
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  aiStyle: text('ai_style').default('formal'), // 新增
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

**新增字段：**
- `aiStyle`：AI风格标签（formal/technical/concise/detailed）
- 默认值 `formal`，确保旧模板兼容

### 3. 周报表扩展（修改现有表）

```typescript
export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  templateId: integer('template_id').references(() => templates.id),
  aiStyleOverride: text('ai_style_override'), // 新增
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

**新增字段：**
- `aiStyleOverride`：周报编辑时覆盖的风格（可选）
- 未设置时使用模板的 `aiStyle`

## AI风格配置设计

### AI风格配置文件

```typescript
export interface AIStyleConfig {
  label: string                    // 显示名称
  systemPrompt: string             // 系统Prompt
  temperature: number              // 模型温度参数
  scoreWeights: {                  // 评分权重配置
    structure: number              // 结构维度权重
    content: number                // 内容维度权重
    value: number                  // 价值维度权重
  }
  // 预留扩展位（P3阶段不暴露给用户）
  detailLevel?: 'low' | 'medium' | 'high'
  resultOriented?: 'low' | 'medium' | 'high'
}

export const aiStyles: Record<string, AIStyleConfig> = {
  formal: {
    label: '正式汇报',
    systemPrompt: '你是专业的职场周报润色助手，表达正式严谨，突出成果价值，语言精炼专业。',
    temperature: 0.3,
    scoreWeights: {
      structure: 0.25,
      content: 0.3,
      value: 0.45,
    }
  },
  technical: {
    label: '技术研发',
    systemPrompt: '你是技术研发周报助手，表述专业准确，保留技术细节，突出问题解决与技术沉淀。',
    temperature: 0.4,
    scoreWeights: {
      structure: 0.2,
      content: 0.5,
      value: 0.3,
    }
  },
  concise: {
    label: '极简干练',
    systemPrompt: '你是精简周报助手，用短句表达，去掉冗余修饰，只保留核心信息。',
    temperature: 0.2,
    scoreWeights: {
      structure: 0.4,
      content: 0.3,
      value: 0.3,
    }
  },
  detailed: {
    label: '深度复盘',
    systemPrompt: '你是个人工作复盘助手，侧重问题分析、经验沉淀、成长总结，表达平实详细。',
    temperature: 0.5,
    scoreWeights: {
      structure: 0.2,
      content: 0.55,
      value: 0.25,
    }
  },
}
```

### 风格与模板映射

**官方模板默认风格：**
- `official-general` → `formal`（正式汇报）
- `official-tech-dev` → `technical`（技术研发）
- `official-minimal` → `concise`（极简干练）
- `official-personal-review` → `detailed`（深度复盘）

**用户模板风格：**
- 克隆官方模板时继承原模板风格
- 用户可在模板编辑页修改 `aiStyle` 字段

**周报编辑风格覆盖：**
- 用户可在周报编辑时临时选择不同风格
- 存储在 `reports.aiStyleOverride` 字段
- 未设置时使用模板默认风格

### 风格配置使用方式

```typescript
// 统一的风格获取函数
export function getAIStyle(templateId: number, styleOverride?: string): AIStyleConfig {
  const styleKey = styleOverride || getTemplateStyle(templateId) || 'formal'
  return aiStyles[styleKey] || aiStyles.formal
}

// 所有AI接口统一调用
function callAI(prompt: string, style: AIStyleConfig) {
  return openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: style.systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: style.temperature,
  })
}
```

## API设计

### 1. AI能力接口（新增）

#### 1.1 单条事件润色

```typescript
// POST /api/ai/polish-event
// 请求体
{
  eventContent: string,  // 原始事件内容
  templateId: number,    // 模板ID（用于获取风格）
  styleOverride?: string // 可选：周报级风格覆盖
}

// 响应
{
  polishedContent: string,  // 润色后内容
  style: string,            // 使用风格标签
  message: "润色完成"
}
```

**Prompt模板：**
```
请将以下工作事件润色为符合{风格}的周报条目：
- 突出成果/价值/影响
- 使用量化数据
- 保持{风格}的语言特点

原始内容：{eventContent}

润色后内容（保持Markdown格式）：
```

#### 1.2 区块扩写补全

```typescript
// POST /api/ai/expand-section
// 请求体
{
  sectionTitle: string,   // 区块标题（如"本周完成"）
  existingItems: string[], // 已有条目
  events: RawEvent[],     // 相关事件素材
  templateId: number,
  styleOverride?: string
}

// 响应
{
  expandedItems: string[],  // 扩写后条目（包含新增）
  addedCount: number,       // 新增条目数
  message: "扩写完成"
}
```

**Prompt模板：**
```
请基于以下事件素材，补全"{sectionTitle}"区块的内容：
- 已有条目：{existingItems}
- 事件素材：{events}
- 补写风格：{风格}

要求：
1. 保持{风格}的表达方式
2. 每个条目Markdown格式
3. 突出关键信息和量化数据
4. 新增条目标记【新增】

补写结果：
```

#### 1.3 全文统一改写

```typescript
// POST /api/ai/unify-style
// 请求体
{
  reportContent: string,  // 周报全文内容
  templateId: number,
  styleOverride?: string
}

// 响应
{
  unifiedContent: string,  // 改写后全文
  changesCount: number,    // 改动条目数
  message: "统一改写完成"
}
```

**Prompt模板：**
```
请将以下周报全文改写为统一的{风格}：
- 原文内容：{reportContent}
- 目标风格：{风格}

要求：
1. 保持原有结构和信息完整性
2. 统一语言风格为{风格}
3. 优化表达但不改变事实
4. 保持Markdown格式

改写结果：
```

### 2. 句式片段库接口（新增）

```typescript
// GET /api/snippets?category={category}
// 响应
{
  snippets: SentenceSnippet[],
  category: string
}

// POST /api/snippets
// 请求体
{
  content: string,
  category: string
}

// DELETE /api/snippets/[id]
// 仅允许删除用户自定义句式（isBuiltIn=false）
```

### 3. 现有评分接口扩展

```typescript
// POST /api/reports/check（扩展）
// 请求体新增可选参数
{
  content: string,
  templateId?: number,     // 新增：用于获取风格
  styleOverride?: string   // 新增：周报级风格覆盖
}

// 响应保持原有结构
{
  score: { structure, content, value, total },
  suggestions: [...],
  // 内部使用权重计算总分
}
```

**评分逻辑改造：**
```typescript
async function checkReport(content: string, style: AIStyleConfig) {
  // 1. 调用AI获取三维度原始得分
  const rawScores = await getRawScores(content)
  
  // 2. 应用风格权重计算总分
  const totalScore = 
    rawScores.structure * style.scoreWeights.structure +
    rawScores.content * style.scoreWeights.content +
    rawScores.value * style.scoreWeights.value
  
  return {
    score: { ...rawScores, total: totalScore },
    suggestions: await getSuggestions(content, style)
  }
}
```

## 前端组件设计

### 1. 编辑器侧边栏架构

```
┌─────────────────────────────────────┐
│  周报编辑器 (Milkdown)               │
├─────────────────────────────────────┤
│  侧边栏（右侧固定宽度）               │
│  ┌───────────────────────────────────┐│
│  │ [AI助手] [句式库] ← Tab切换       ││
│  ├───────────────────────────────────┤│
│  │ AI助手Tab：                       ││
│  │  ┌───────────────────────────────┐││
│  │  │ 选择风格：[正式汇报 ▼]         │││
│  │  ├───────────────────────────────┤││
│  │  │ [润色选中内容]                 │││
│  │  │ [扩写当前区块]                 │││
│  │  │ [全文统一改写]                 │││
│  │  │ [一键评分检查]                 │││
│  │  └───────────────────────────────┘││
│  ├───────────────────────────────────┤│
│  │ 句式库Tab：                       ││
│  │  ┌───────────────────────────────┐││
│  │  │ [成果] [问题] [计划] [量化]    │││
│  │  ├───────────────────────────────┤││
│  │  │ ○ 完成XX优化，指标提升XX%      │││
│  │  │ ○ 遇到XX问题，根因XX，已解决   │││
│  │  │   [+新增句式]                  │││
│  │  └───────────────────────────────┘││
│  └───────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 2. 核心组件列表

| 组件名 | 功能 | 状态管理 |
|--------|------|----------|
| EditorSidebar | AI助手/句式库Tab切换容器 | 本地state |
| AIAssistantPanel | AI功能操作面板 | 本地state |
| StyleSelector | AI风格下拉选择 | 本地state |
| SnippetLibraryPanel | 句式库分类展示 | 本地state |
| SnippetCategoryTabs | 成果/问题/计划/量化Tab切换 | 本地state |
| SnippetCard | 单条句式卡片 + 插入按钮 | 无状态 |
| AddSnippetDialog | 新增句式对话框 | 本地state |
| AIOperationButton | AI操作按钮（润色/扩写/统一） | 无状态 |

### 3. AI助手面板组件

```typescript
export function AIAssistantPanel({ reportId, templateId }) {
  const [selectedStyle, setSelectedStyle] = useState<string>()
  const [isProcessing, setIsProcessing] = useState(false)
  
  async function handlePolishEvent() {
    const selectedText = getEditorSelection()
    if (!selectedText) {
      toast.error('请先选中要润色的事件内容')
      return
    }
    
    setIsProcessing(true)
    const result = await fetch('/api/ai/polish-event', {
      method: 'POST',
      body: JSON.stringify({
        eventContent: selectedText,
        templateId,
        styleOverride: selectedStyle
      })
    })
    const data = await result.json()
    replaceEditorSelection(data.polishedContent)
    setIsProcessing(false)
    toast.success('润色完成')
  }
  
  return (
    <div className="space-y-4">
      <StyleSelector 
        value={selectedStyle}
        onChange={setSelectedStyle}
        templateId={templateId}
      />
      
      <div className="space-y-2">
        <AIOperationButton 
          onClick={handlePolishEvent}
          loading={isProcessing}
          icon={<Sparkles />}
        >
          润色选中内容
        </AIOperationButton>
        
        <AIOperationButton onClick={handleExpandSection}>
          扩写当前区块
        </AIOperationButton>
        
        <AIOperationButton onClick={handleUnifyStyle}>
          全文统一改写
        </AIOperationButton>
        
        <AIOperationButton onClick={handleCheckReport}>
          一键评分检查
        </AIOperationButton>
      </div>
    </div>
  )
}
```

### 4. 句式库面板组件

```typescript
export function SnippetLibraryPanel() {
  const [category, setCategory] = useState<string>('成果')
  const [snippets, setSnippets] = useState<SentenceSnippet[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  
  useEffect(() => {
    fetch(`/api/snippets?category=${category}`)
      .then(res => res.json())
      .then(data => setSnippets(data.snippets))
  }, [category])
  
  function handleInsertSnippet(content: string) {
    insertToEditor(content)
  }
  
  return (
    <div className="space-y-4">
      <SnippetCategoryTabs 
        value={category}
        onChange={setCategory}
      />
      
      <div className="space-y-2">
        {snippets.map(snippet => (
          <SnippetCard
            key={snippet.id}
            snippet={snippet}
            onInsert={handleInsertSnippet}
            onDelete={() => handleDeleteSnippet(snippet.id)}
          />
        ))}
        
        <Button 
          variant="outline"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          新增句式
        </Button>
      </div>
      
      <AddSnippetDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        defaultCategory={category}
        onAdd={(content, cat) => handleAddSnippet(content, cat)}
      />
    </div>
  )
}
```

### 5. 模板编辑页扩展

**新增AI风格选择器：**

```typescript
<Select 
  value={template.aiStyle}
  onValueChange={(val) => setTemplate({...template, aiStyle: val})}
>
  <SelectLabel>AI风格</SelectLabel>
  <SelectItem value="formal">正式汇报</SelectItem>
  <SelectItem value="technical">技术研发</SelectItem>
  <SelectItem value="concise">极简干练</SelectItem>
  <SelectItem value="detailed">深度复盘</SelectItem>
</Select>
```

### 6. 新建周报页扩展

**新增风格提示：**

```typescript
// 选择模板后自动显示对应的AI风格
{selectedTemplateId && (
  <div className="mt-2 text-sm text-muted-foreground">
    默认AI风格：{getTemplateStyleLabel(selectedTemplateId)}
    <Button variant="link" size="sm">
      了解风格差异
    </Button>
  </div>
)}
```

## 预置句式设计

### 官方预置句式列表（20-30条）

**初始化时机：**
- 应用启动时检查数据库，若句式表为空则批量插入预置句式
- 所有预置句式标记为 `isBuiltIn=true`

### 成果句式（10条）

```typescript
const achievementSnippets = [
  '完成XX优化，性能提升XX%，响应时间从XX降至XX',
  '实现XX功能，覆盖XX场景，用户满意度达XX%',
  '解决XX个技术问题，系统稳定性提升XX%',
  '交付XX项目，提前XX天完成，节约成本XX%',
  '完成XX调研，输出XX份文档，团队知识沉淀增强',
  '优化XX流程，效率提升XX%，减少人工介入XX次',
  '重构XX模块，代码行数减少XX%，维护成本降低',
  '上线XX版本，修复XX个Bug，用户反馈XX条已处理',
  '完成XX培训，覆盖XX人，技能达标率XX%',
  '主导XX项目，协调XX个团队，按时交付无延期',
]
```

### 问题句式（8条）

```typescript
const problemSnippets = [
  '遇到XX问题，根因分析为XX，已通过XX方式临时解决，长期方案为XX',
  '发现XX风险，影响范围XX，已制定应急预案，预计XX时间彻底解决',
  'XX模块出现性能瓶颈，定位到XX位置，优化方案已评审待实施',
  'XX流程存在阻塞点，涉及XX环节，建议优化路径为XX',
  'XX需求理解偏差，导致返工XX次，已加强沟通机制避免重复',
  'XX技术方案选型困难，对比XX种方案后选择XX，理由为XX',
  'XX资源不足，影响XX进度，已协调XX部门支持，预计XX到位',
  'XX测试发现缺陷XX个，严重XX个，已修复XX个，剩余XX个待处理',
]
```

### 计划句式（6条）

```typescript
const planSnippets = [
  '启动XX工作，预计完成XX产出，交付节点XX',
  '推进XX项目，本周完成XX阶段，下周进入XX阶段',
  '优化XX模块，计划XX时间完成，预期收益XX',
  '调研XX技术，输出XX文档，为后续决策提供依据',
  '组织XX活动，目标覆盖XX人，预计XX时间完成',
  '完成XX学习计划，掌握XX技能，应用于XX场景',
]
```

### 量化句式（6条）

```typescript
const quantificationSnippets = [
  '本周处理XX项任务，完成率XX%，同比提升XX%',
  '参与XX次会议，决策XX项事项，跟进XX项待办',
  '编写XX行代码，新增XX功能，优化XX模块',
  '修复XX个Bug，严重XX个，一般XX个，轻微XX个',
  '评审XX份方案，通过XX份，驳回XX份，待补充XX份',
  '沟通XX次，协调XX个团队，解决XX个冲突点',
]
```

### 句式初始化逻辑

```typescript
// src/lib/init-snippets.ts
export async function initializeSnippets() {
  const existingCount = await db.select().from(sentenceSnippets)
  
  if (existingCount.length === 0) {
    const allSnippets = [
      ...achievementSnippets.map(s => ({ content: s, category: '成果', isBuiltIn: true })),
      ...problemSnippets.map(s => ({ content: s, category: '问题', isBuiltIn: true })),
      ...planSnippets.map(s => ({ content: s, category: '计划', isBuiltIn: true })),
      ...quantificationSnippets.map(s => ({ content: s, category: '量化', isBuiltIn: true })),
    ]
    
    await db.insert(sentenceSnippets).values(allSnippets)
    console.log('预置句式初始化完成，共', allSnippets.length, '条')
  }
}
```

### 句式插入交互

**用户操作流程：**
1. 点击句式卡片 → 直接插入到编辑器光标位置
2. 用户手动替换句式中的 `XX` 占位符为实际数据
3. 编辑完成后可选中内容，点"保存到句式库"沉淀为新句式

**示例效果：**
```
点击句式："完成XX优化，性能提升XX%，响应时间从XX降至XX"
编辑器插入："完成XX优化，性能提升XX%，响应时间从XX降至XX"
用户手动修改："完成数据库查询优化，性能提升35%，响应时间从2.1s降至0.8s"
```

## 错误处理

### API错误场景

| 场景 | HTTP状态码 | 错误响应 | 处理方式 |
|------|-----------|---------|---------|
| AI润色内容为空 | 400 | `{ error: "内容不能为空" }` | 显示toast提示 |
| AI调用失败 | 500 | `{ error: "AI服务暂时不可用" }` | 显示toast，记录日志 |
| 风格配置不存在 | 400 | `{ error: "风格配置无效" }` | 自动fallback到formal |
| 句式内容过长(>500字) | 400 | `{ error: "句式内容过长" }` | 显示具体错误 |
| 删除内置句式 | 403 | `{ error: "内置句式不可删除" }` | 显示toast提示 |
| 模板不存在 | 404 | `{ error: "模板不存在" }` | 跳转模板列表页 |
| OpenAI API限流 | 429 | `{ error: "请求过于频繁，请稍后重试" }` | 显示toast+冷却提示 |

### 前端错误处理

**统一错误提示方式：**
```typescript
import { toast } from 'sonner'

// AI操作失败
toast.error('AI润色失败，请稍后重试', {
  action: { label: '重试', onClick: () => retryOperation() }
})

// 句式操作失败
toast.error('句式保存失败', { description: error.message })
```

**降级处理策略：**
- AI润色失败时保留原内容不变
- 评分失败时显示"评分服务暂时不可用"
- 句式库加载失败时显示空列表+提示刷新

### 特殊场景处理

| 场景 | 处理方式 |
|------|---------|
| 编辑器未选中内容 | 提示"请先选中要润色的事件内容" |
| 区块无事件素材 | 提示"当前区块无事件素材可扩写" |
| 全文改写中断 | 保留原内容，提示用户手动重试 |
| 句式插入位置异常 | 插入到文档末尾，提示用户调整位置 |

## 测试策略

### 前端组件单元测试

**测试工具：** Vitest + React Testing Library

**测试覆盖表：**

| 组件 | 测试点 | 测试数量 |
|------|--------|---------|
| StyleSelector | 渲染4种风格；选择触发onChange | 3个 |
| AIAssistantPanel | 润色按钮禁用状态；AI调用触发；loading状态 | 5个 |
| SnippetLibraryPanel | 分类切换；句式列表渲染；插入触发 | 4个 |
| SnippetCard | 内置/自定义标识；删除按钮显示条件 | 3个 |
| AddSnippetDialog | 必填验证；分类选择；保存触发 | 4个 |

**测试示例：**

```typescript
// AIAssistantPanel.test.tsx
test('polish button disabled when no selection', () => {
  render(<AIAssistantPanel templateId={1} />)
  
  const polishBtn = screen.getByText('润色选中内容')
  expect(polishBtn).toBeDisabled()
  
  // 模拟编辑器选中内容
  mockEditorSelection('完成优化工作')
  expect(polishBtn).not.toBeDisabled()
})

test('calls polish API with correct params', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ 
    polishedContent: '完成性能优化...' 
  })
  
  render(<AIAssistantPanel templateId={1} />)
  
  fireEvent.click(screen.getByText('润色选中内容'))
  
  expect(mockFetch).toHaveBeenCalledWith('/api/ai/polish-event', {
    body: JSON.stringify({
      eventContent: '完成优化工作',
      templateId: 1
    })
  })
})
```

### 后端API测试

**测试工具：** Vitest

**测试覆盖：**
- AI润色接口：Prompt组装、风格参数传递、返回格式
- 句式CRUD：增删改查逻辑、内置句式保护
- 评分权重计算：权重应用、总分计算正确性
- 错误处理：各种异常场景返回正确HTTP状态码

**测试示例：**

```typescript
// api/ai/polish-event.test.ts
test('polish with formal style', async () => {
  const request = {
    eventContent: '修复了bug',
    templateId: 1
  }
  
  const response = await POST(request)
  const data = await response.json()
  
  expect(data.style).toBe('formal')
  expect(data.polishedContent).toContain('修复')
  expect(data.polishedContent).toContain('问题')
})

// api/snippets.test.ts
test('prevents deleting built-in snippet', async () => {
  const builtInSnippet = await db.insert(sentenceSnippets).values({
    content: '测试句式',
    category: '成果',
    isBuiltIn: true
  })
  
  const response = await DELETE(`/api/snippets/${builtInSnippet.id}`)
  
  expect(response.status).toBe(403)
  expect(await response.json()).toHaveProperty('error', '内置句式不可删除')
})
```

### 集成测试

**测试工具：** Playwright

**测试场景：**
- AI润色完整流程：选中内容 → 点击润色 → 内容替换
- 句式库插入流程：切换分类 → 点击句式 → 编辑器插入
- 评分权重差异验证：同一内容在不同风格下评分不同
- 风格覆盖流程：周报编辑时选择不同风格覆盖模板默认

## 向下兼容设计

### 数据库迁移策略

**Migration文件：** `0004_add_ai_enhancement.sql`

```sql
-- 1. 新增句式片段表
CREATE TABLE sentence_snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '通用',
  is_built_in INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 2. 模板表新增aiStyle字段
ALTER TABLE templates ADD COLUMN ai_style TEXT DEFAULT 'formal';

-- 3. 周报表新增aiStyleOverride字段
ALTER TABLE reports ADD COLUMN ai_style_override TEXT;

-- 4. 初始化预置句式（通过应用层执行）
-- 不在SQL中硬编码，避免字符编码问题
```

**迁移执行：**
- 使用Drizzle Kit自动生成migration
- 新字段都有默认值，确保旧数据兼容
- 应用启动时自动检查并执行migration

### 兼容性保证

| 场景 | 保证措施 |
|------|---------|
| 旧模板数据 | 新字段自动填充默认值，原有功能不受影响 |
| 旧周报数据 | aiStyleOverride字段为空，使用模板默认风格 |
| 旧周报编辑 | 新增字段不影响现有编辑流程 |
| AI评分接口 | 不传风格参数时使用默认权重，保持原有评分逻辑 |
| 句式库首次访问 | 自动初始化预置句式，用户立即可用 |

### API向下兼容

**评分接口保持兼容：**
```typescript
// POST /api/reports/check
// 旧调用方式仍然有效（不传风格参数）
{
  content: string  // 原有参数
}

// 新调用方式（可选传风格）
{
  content: string,
  templateId?: number,    // 新增可选
  styleOverride?: string  // 新增可选
}
```

**处理逻辑：**
```typescript
async function checkReport(body: CheckRequest) {
  const style = body.styleOverride || 
                getTemplateStyle(body.templateId) || 
                'formal'
  
  // 使用风格权重计算评分
  return calculateScore(body.content, style)
}
```

## 部署策略

### AI风格配置更新机制

**更新流程：**
```
修改 src/lib/ai/styles.ts → 提交代码 → 部署 → 
应用重启 → 自动加载新风格配置 → 用户立即看到更新
```

**关键点：**
- AI风格配置存代码配置，不存数据库
- 更新无需执行migration，只需重新部署
- 用户周报编辑时的风格覆盖不受影响

### 预置句式更新机制

**两种更新方式：**

1. **新增官方句式：**
   - 修改 `src/lib/init-snippets.ts`
   - 重新部署后，首次访问句式库时自动补充新句式
   - 不会重复插入已存在的句式（通过content唯一性检查）

2. **修改官方句式：**
   - 直接修改配置文件中的句式内容
   - 已插入数据库的旧句式保持不变
   - 用户可手动删除旧句式，新部署后会插入新版本

**版本控制建议：**
- `styles.ts` 和 `init-snippets.ts` 纳入git管理
- 配置变更通过git提交记录追踪
- 建议在配置中添加 `version` 字段记录版本号

## 非功能性需求

### 性能考虑

| 场景 | 性能指标 | 实现方式 |
|------|---------|---------|
| AI润色单条事件 | < 3秒 | OpenAI API调用 |
| AI扩写区块 | < 5秒 | 批量处理事件素材 |
| AI全文统一改写 | < 10秒 | 全文处理+返回 |
| 句式库加载 | < 100ms | 数据库查询+分类过滤 |
| 句式插入 | < 10ms | 前端操作，无需网络请求 |

**性能优化建议：**
- AI操作显示loading状态，避免用户误操作
- 句式库数据前端缓存，减少重复请求
- 评分结果可缓存（内容未变化时不重新评分）

### 安全考虑

- 模板风格参数验证：只允许预定义的4种风格值
- 句式内容验证：防止非法字符注入，限制长度<500字
- 删除权限控制：只允许删除用户自定义句式
- AI调用频率限制：防止恶意刷API（OpenAI自带限流）
- 数据库操作使用Drizzle ORM，防止SQL注入

### 可维护性

- AI风格配置集中管理在单一文件
- 句式初始化逻辑独立封装
- 前端组件职责单一，易于扩展
- API设计符合RESTful规范
- 数据库schema使用Drizzle ORM管理

## 开发工作量评估

### 阶段划分与工时

| 阶段 | 任务内容 | 预估工时 |
|------|---------|---------|
| 阶段1：数据层扩展 | | |
| | 新增sentence_snippets表 + migration | 1小时 |
| | 模板表新增aiStyle字段 | 0.5小时 |
| | 周报表新增aiStyleOverride字段 | 0.5小时 |
| | 预置句式初始化逻辑 | 1小时 |
| 阶段2：AI配置层 | | |
| | AI风格配置文件编写（styles.ts） | 2小时 |
| | 风格获取统一函数封装 | 1小时 |
| | 评分权重适配改造 | 1.5小时 |
| 阶段3：API接口层 | | |
| | /api/ai/polish-event 润色接口 | 2小时 |
| | /api/ai/expand-section 扩写接口 | 2.5小时 |
| | /api/ai/unify-style 统一改写接口 | 1.5小时 |
| | /api/snippets 句式CRUD接口 | 1.5小时 |
| | /api/reports/check 扩展风格参数 | 1小时 |
| 阶段4：前端组件层 | | |
| | EditorSidebar侧边栏容器 | 2小时 |
| | AIAssistantPanel AI助手面板 | 3小时 |
| | SnippetLibraryPanel 句式库面板 | 3小时 |
| | 模板编辑页新增风格选择器 | 1小时 |
| | 新建周报页风格提示 | 0.5小时 |
| 阶段5：测试验证 | | |
| | 前端组件单元测试 | 2小时 |
| | 后端API测试 | 2小时 |
| | 集成测试（Playwright） | 2小时 |
| | 兼容性验证（旧数据+旧功能） | 1.5小时 |
| 阶段6：联调优化 | | |
| | Prompt效果调优 | 2小时 |
| | 性能优化（loading状态、缓存） | 1小时 |
| | 错误处理完善 | 1小时 |
| 总计 | | 约27.5小时（3-4天） |

### 开发优先级建议

**建议按阶段顺序开发，每个阶段完成后验证：**

1. 阶段1-2（数据层+配置层）：基础就绪，可独立测试
2. 阶段3（API层）：接口可用，可手动验证AI效果
3. 阶段4（前端层）：完整UI流程，用户体验验证
4. 阶段5-6（测试+优化）：质量保障，最终交付

**关键风险点：**
- AI Prompt效果调优（预留足够时间）
- Milkdown编辑器集成（插入/替换操作）
- 向下兼容性验证（旧数据+旧周报）

## 成功标准

**验收条件：**

1. 数据库新增sentence_snippets表，预置句式自动初始化
2. 模板表新增aiStyle字段，默认值formal生效
3. AI风格配置文件完整，4种风格可正确获取
4. AI润色接口可用，返回内容符合风格特点
5. AI扩写接口可用，根据事件素材补全区块
6. AI统一改写接口可用，全文风格统一
7. 句式库API可用，支持增删查操作
8. 评分接口权重适配，不同风格评分有差异
9. 前端侧边栏组件可用，AI助手和句式库切换正常
10. 句式插入功能可用，点击直接插入编辑器
11. 模板编辑页新增风格选择器
12. 旧周报、旧模板完全兼容，原有功能不受影响

## 后续规划

**P4阶段（可选扩展）：**

- AI智能分类事件：自动推断事件属于哪个区块类型
- AI模板推荐：根据周报内容智能推荐最合适的模板
- 句式库智能推荐：根据当前编辑内容推荐相关句式
- AI历史版本对比：对比不同风格润色效果，选择最优

**架构演进方向：**

- AI能力抽象为独立服务层（/api/ai统一入口）
- 支持多AI模型切换（OpenAI/Claude/本地模型）
- AI评分系统升级为完整Prompt动态配置（B方案）
- 句式库支持用户协作分享（多人工具场景）

**性能优化方向：**

- AI调用结果缓存（减少重复请求）
- 批量AI处理（一次润色多个事件）
- 流式返回（长文本改写时逐步展示）
- 预计算评分（保存周报时自动评分）

## 总结

本设计采用渐进式扩展现有系统，实现：
- AI风格简单标签 + 底层预留结构化扩展能力
- 句式库数据库持久化 + 侧边栏轻量管理
- 评分权重动态适配 + 向下兼容现有评分逻辑
- 完全复用已有AI底层封装，只扩展业务层
- 所有改动保证向下兼容，旧数据、旧功能不受影响

设计满足P3阶段所有需求，为后续AI能力扩展预留架构空间，开发量可控（3-4天），适合个人工具快速落地。