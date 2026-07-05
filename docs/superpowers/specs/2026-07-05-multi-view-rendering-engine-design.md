# P4 模板多视图渲染引擎设计规范

## 项目背景

**当前项目**：Next.js 16 + TypeScript + Drizzle + SQLite  
**前置依赖**：已完成P0-P3（模板标准化、变量引擎、事件绑定、AI Enhancement）  
**阶段目标**：实现模板多视图渲染引擎，支持同一周事件素材生成两种差异化周报输出（领导版+个人版）  
**边界限制**：P4阶段不开放用户自定义配置界面，仅官方模板预设默认值，后续阶段渐进开放

---

## 1. 核心目标与设计原则

### 1.1 核心目标

1. **素材一次采集、双向产出**：rawEvents表作为唯一真相源，一次标记可生成领导版和个人版两种输出
2. **实时预览切换**：前端一键切换视图，实时渲染不同版本，数据库始终保存完整个人版结构
3. **导出时版本选择**：导出/分享环节提供领导版/个人版选择，输出对应视图的最终内容
4. **架构预留**：数据结构支持未来扩展（用户自定义、新增视图类型），P4阶段不开放配置界面

### 1.2 P4边界定义

**包含范围**：
- ✅ 支持领导版和个人版两种视图类型
- ✅ 数据库零改动（复用P1预留的config字段）
- ✅ 4套官方模板预设默认viewConfigs配置
- ✅ 前端视图切换按钮 + 导出版本选择对话框
- ✅ 渲染引擎支持enabledSections参数

**排除范围**：
- ❌ 不新增第三种视图类型（后续P5扩展）
- ❌ 不提供用户自定义maxItems/section启用开关的配置界面（后续P5扩展）
- ❌ 不修改周报保存逻辑（始终保存完整个人版）
- ❌ 不新增section级别的AI风格配置（后续P5扩展）

### 1.3 关键设计原则

1. **单一真相源**：数据库始终保存完整个人版结构化数据，领导版仅前端实时渲染预览
2. **配置驱动**：视图差异通过TemplateConfig.viewConfigs配置驱动，不修改模板内容本身
3. **零存储触发**：视图切换不触发数据库写入，仅调用渲染API刷新编辑器内容
4. **架构预留**：数据结构设计支持未来扩展，P4阶段不开放用户配置界面，落地成本极低

---

## 2. 整体架构设计

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  前端层：视图切换UI + 实时预览                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 视图切换按钮 │  │ 编辑器实时渲染│  │ 导出版本选择 │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↓ viewType参数
┌─────────────────────────────────────────────────────────┐
│  服务层：渲染API + 视图配置提取                           │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ 视图配置解析 │  │ 多视图渲染引擎│                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
                        ↓ viewConfig
┌─────────────────────────────────────────────────────────┐
│  数据层：模板配置 + 事件素材                              │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │Template.config│  │  rawEvents   │                     │
│  │.viewConfigs   │  │  (唯一真相源)│                     │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 文件结构新增

```
src/
├── lib/
│   ├── db/
│   │   └── schema.ts          # 类型定义扩展（SectionType、ViewConfig）
│   └── template/
│       ├── render.ts          # 多视图渲染逻辑扩展（enabledSections参数）
│       └── view-config.ts     # 视图配置提取函数（新增）
│   └── official-templates.ts   # 官方模板预设viewConfigs（修改）
│
├── app/
│   ├── api/
│   │   ├── templates/[id]/
│   │   │   └── render/route.ts # viewType参数支持（修改）
│   │   └── export/
│   │       └── route.ts        # 导出API（新增）
│   │
│   └── edit/[id]/
│       └── page.tsx            # 视图切换按钮集成（修改）
│
└── components/
    ├── ViewSwitcher.tsx        # 视图切换组件（新增）
    ├── ExportDialog.tsx        # 导出对话框（新增）
    └── EditorSidebar.tsx       # AI风格同步（修改）
```

### 2.3 数据流设计

```
用户点击"切换到领导版"
    ↓
前端调用 /api/templates/{id}/render?viewType=leadership
    ↓
服务端查询模板config.viewConfigs.leadership
    ↓
extractViewConfig提取视图配置
    ↓
renderTemplate(content, { events, enabledSections, sectionConfig })
    ↓
返回渲染后的领导版Markdown + aiStyle=formal
    ↓
前端更新编辑器内容 + AI风格切换
    ↓
用户可继续编辑（不触发数据库保存）
```

---

## 3. 数据层设计

### 3.1 Schema类型扩展（零数据库改动）

**修改文件**：`src/lib/db/schema.ts`

```typescript
// 新增sectionType枚举值（支持pitfall和pending）
export type SectionType = 'achievement' | 'risk' | 'routine' | 'plan' | 'pitfall' | 'pending'

// 新增视图配置接口
export interface ViewConfig {
  enabledSections: SectionType[]      // 启用的section列表
  sectionConfig: Record<SectionType, SectionRenderConfig>  // 各section渲染配置
  aiStyle: AIStyle                    // 默认AI风格
}

// 扩展TemplateConfig接口（复用P1预留的config字段）
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
  viewConfigs?: {
    leadership?: ViewConfig  // 领导版视图配置
    personal?: ViewConfig    // 个人版视图配置
  }
}
```

### 3.2 官方模板预设配置

**修改文件**：`src/lib/official-templates.ts`

所有4套官方模板的config字段预设默认viewConfigs：

```typescript
export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-general',
    name: '通用周报模板',
    content: `## 本周完成
{{本周日期范围}}

## 核心成果
{{核心成果}}

## 问题与风险
{{问题与风险}}

## 日常事务
{{日常事务}}

## 下周计划
{{下周计划}}

## 踩坑记录
{{踩坑记录}}

## 问题沉淀
{{问题沉淀}}`,
    description: '适用于通用工作汇报场景',
    tags: ['通用', '正式'],
    config: {
      viewConfigs: {
        leadership: {
          enabledSections: ['achievement', 'risk', 'plan'],
          sectionConfig: {
            achievement: { maxItems: 3, autoSort: true, filterTrivial: true },
            risk: { maxItems: 3, autoSort: true, filterTrivial: true },
            plan: { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['achievement', 'risk', 'routine', 'plan', 'pitfall', 'pending'],
          sectionConfig: {
            achievement: { maxItems: undefined, autoSort: false, filterTrivial: false },
            risk: { maxItems: undefined, autoSort: false, filterTrivial: false },
            routine: { maxItems: undefined, autoSort: false, filterTrivial: false },
            plan: { maxItems: undefined, autoSort: false, filterTrivial: false },
            pitfall: { maxItems: undefined, autoSort: false, filterTrivial: false },
            pending: { maxItems: undefined, autoSort: false, filterTrivial: false },
          },
          aiStyle: 'detailed'
        }
      }
    }
  },
  // 其他3套模板同理...
]
```

### 3.3 Migration策略

**无需Migration文件**：
- P1阶段已预留config字段（JSON类型），直接扩展viewConfigs子属性
- SectionType枚举扩展仅需修改TypeScript类型定义，不影响数据库
- rawEvents表的sectionType字段已支持字符串类型，新值（pitfall/pending）自动兼容

**官方模板更新方式**：
- 修改official-templates.ts代码预设viewConfigs
- 无需执行数据库migration或手动更新模板记录
- 用户选择官方模板时，自动获得预设配置

---

## 4. API设计

### 4.1 模板渲染API扩展

**修改文件**：`src/app/api/templates/[id]/render/route.ts`

**新增参数**：`viewType`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const viewType = (searchParams.get('viewType') as 'leadership' | 'personal') || 'personal'
    const baseDateStr = searchParams.get('date') || new Date().toISOString()
    const baseDate = new Date(baseDateStr)
    
    const templateId = params.id
    let templateContent: string
    let templateConfig: TemplateConfig
    
    // 获取模板内容和配置
    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (!template) {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 })
      }
      templateContent = template.content
      templateConfig = template.config || {}
    } else {
      const db = getDb()
      const templateIdNum = parseInt(templateId.replace('user-', ''))
      const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
      if (!template[0]) {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 })
      }
      templateContent = template[0].content
      templateConfig = template[0].config || {}
    }
    
    // 提取视图配置
    const viewConfig = extractViewConfig(templateConfig, viewType)
    
    // 获取本周事件（如果有）
    const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
    const events = await getWeekEvents(weekStart, weekEnd)
    
    // 渲染模板
    const renderedContent = renderTemplate(templateContent, {
      date: baseDate,
      events,
      sectionConfig: viewConfig.sectionConfig,
      enabledSections: viewConfig.enabledSections
    })
    
    return NextResponse.json({
      content: renderedContent,
      templateId,
      viewType,
      aiStyle: viewConfig.aiStyle,
      baseDate: baseDate.toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: '模板渲染失败', details: String(error) },
      { status: 500 }
    )
  }
}
```

### 4.2 视图配置提取函数

**新建文件**：`src/lib/template/view-config.ts`

```typescript
import { TemplateConfig, ViewConfig, SectionType, AIStyle, SectionRenderConfig } from '@/lib/db/schema'

/**
 * 从模板配置中提取指定视图的配置
 * @param templateConfig 模板配置对象
 * @param viewType 视图类型（leadership | personal）
 * @returns 视图配置对象（包含enabledSections、sectionConfig、aiStyle）
 */
export function extractViewConfig(
  templateConfig: TemplateConfig,
  viewType: 'leadership' | 'personal'
): ViewConfig {
  // 默认配置（兜底，用于无viewConfigs的旧模板）
  const defaultViewConfigs: Record<'leadership' | 'personal', ViewConfig> = {
    personal: {
      enabledSections: ['achievement', 'risk', 'routine', 'plan', 'pitfall', 'pending'],
      sectionConfig: {
        achievement: { maxItems: undefined, autoSort: false, filterTrivial: false },
        risk: { maxItems: undefined, autoSort: false, filterTrivial: false },
        routine: { maxItems: undefined, autoSort: false, filterTrivial: false },
        plan: { maxItems: undefined, autoSort: false, filterTrivial: false },
        pitfall: { maxItems: undefined, autoSort: false, filterTrivial: false },
        pending: { maxItems: undefined, autoSort: false, filterTrivial: false },
      },
      aiStyle: 'detailed'
    },
    leadership: {
      enabledSections: ['achievement', 'risk', 'plan'],
      sectionConfig: {
        achievement: { maxItems: 3, autoSort: true, filterTrivial: true },
        risk: { maxItems: 3, autoSort: true, filterTrivial: true },
        plan: { maxItems: 3, autoSort: true, filterTrivial: false },
      },
      aiStyle: 'formal'
    }
  }
  
  // 优先使用模板预设配置
  if (templateConfig.viewConfigs?.[viewType]) {
    return templateConfig.viewConfigs[viewType]
  }
  
  // 兜底：返回默认配置
  return defaultViewConfigs[viewType]
}

/**
 * 获取本周事件列表（从rawEvents表）
 * @param weekStart 周起始日期
 * @param weekEnd 周结束日期
 * @returns 事件列表
 */
async function getWeekEvents(weekStart: Date, weekEnd: Date): Promise<RawEvent[]> {
  const db = getDb()
  return await db.select().from(rawEvents).where(
    and(
      gte(rawEvents.eventTime, weekStart),
      lte(rawEvents.eventTime, weekEnd)
    )
  )
}
```

### 4.3 导出API（新增）

**新建文件**：`src/app/api/export/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { reports, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate } from '@/lib/template/render'
import { extractViewConfig } from '@/lib/template/view-config'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function POST(request: Request) {
  try {
    const { reportId, viewType, format = 'markdown' } = await request.json()
    
    // 获取周报数据
    const db = getDb()
    const report = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1)
    if (!report[0]) {
      return NextResponse.json({ error: '周报不存在' }, { status: 404 })
    }
    
    // 获取模板配置
    let templateConfig: TemplateConfig
    if (report[0].templateId?.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === report[0].templateId)
      templateConfig = template?.config || {}
    } else {
      const templateIdNum = parseInt(report[0].templateId?.replace('user-', '') || '0')
      const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
      templateConfig = template[0]?.config || {}
    }
    
    // 提取视图配置
    const viewConfig = extractViewConfig(templateConfig, viewType)
    
    // 获取本周事件
    const weekStart = new Date(report[0].weekStart)
    const weekEnd = new Date(report[0].weekEnd)
    const events = await getWeekEvents(weekStart, weekEnd)
    
    // 重新渲染对应视图
    const exportContent = renderTemplate(report[0].content, {
      date: weekStart,
      events,
      sectionConfig: viewConfig.sectionConfig,
      enabledSections: viewConfig.enabledSections
    })
    
    // 返回导出内容
    return NextResponse.json({
      content: exportContent,
      viewType,
      format,
      reportId
    })
  } catch (error) {
    return NextResponse.json(
      { error: '导出失败', details: String(error) },
      { status: 500 }
    )
  }
}
```

---

## 5. 渲染引擎设计

### 5.1 renderTemplate函数扩展

**修改文件**：`src/lib/template/render.ts`

**新增参数**：`enabledSections`（控制哪些section参与渲染）

```typescript
export interface RenderOptions {
  date?: Date
  events?: RawEvent[]
  sectionConfig?: TemplateConfig['sectionConfig']
  enabledSections?: SectionType[]  // 新增：启用的section列表
}

const EMPTY_LIST_ITEMS = '- \n- \n- '

const TRIVIAL_KEYWORDS = [
  'fix typo',
  'update comment',
  'refactor minor',
  'chore',
  'docs',
  'formatting',
  'whitespace',
]

function isTrivialEvent(content: string): boolean {
  if (content.length < 5) return true
  const lowerContent = content.toLowerCase()
  return TRIVIAL_KEYWORDS.some((kw) => lowerContent.includes(kw))
}

function filterAndFormatEvents(
  events: RawEvent[],
  type: SectionType,
  config?: SectionRenderConfig
): string {
  let filtered = events.filter((e) => e.sectionType === type)

  if (config?.filterTrivial) {
    filtered = filtered.filter((e) => !isTrivialEvent(e.content))
  }

  if (config?.autoSort !== false) {
    filtered.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
  }

  if (config?.maxItems) {
    filtered = filtered.slice(0, config.maxItems)
  }

  if (filtered.length === 0) return EMPTY_LIST_ITEMS
  return filtered.map((e) => `- ${e.content}`).join('\n')
}

/**
 * 移除未启用的section（包括标题和内容）
 * @param content 模板内容
 * @param sectionName section名称（中文）
 * @returns 移除section后的内容
 */
function removeSection(content: string, sectionName: string): string {
  // 匹配section标题 + 后续内容（直到下一个##标题或文件结束）
  const pattern = new RegExp(`## ${sectionName}\\n[^#]*`, 'g')
  return content.replace(pattern, '')
}

export function renderTemplate(content: string, options?: RenderOptions): string {
  const baseDate = options?.date ?? new Date()

  let result = content

  // 1. 系统变量替换（复用P1逻辑）
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  const weekRange = `${format(weekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(weekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  result = result.replace(/\{\{本周日期范围\}\}/g, weekRange)

  const lastWeekStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })
  const lastWeekRange = `${format(lastWeekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(lastWeekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  result = result.replace(/\{\{上周日期范围\}\}/g, lastWeekRange)

  const weekNumber = getWeek(baseDate, { weekStartsOn: 1 })
  result = result.replace(/\{\{当前周数\}\}/g, `第${weekNumber}周`)

  const year = getYear(baseDate)
  result = result.replace(/\{\{年份\}\}/g, year.toString())

  const month = getMonth(baseDate) + 1
  result = result.replace(/\{\{月份\}\}/g, `${month}月`)

  // 2. Section变量替换（扩展逻辑）
  const SECTION_CONFIG: Record<string, SectionType> = {
    核心成果: 'achievement',
    问题与风险: 'risk',
    下周计划: 'plan',
    日常事务: 'routine',
    踩坑记录: 'pitfall',    // 新增
    问题沉淀: 'pending',    // 新增
  }

  for (const [sectionName, sectionType] of Object.entries(SECTION_CONFIG)) {
    // 新增：检查section是否启用
    if (options?.enabledSections && !options.enabledSections.includes(sectionType)) {
      // section未启用，移除整个section（包括标题）
      result = removeSection(result, sectionName)
      continue
    }

    // 正常渲染section内容
    let replacement: string

    if (options?.events && options.events.length > 0) {
      replacement = filterAndFormatEvents(
        options.events,
        sectionType,
        options.sectionConfig?.[sectionType]
      )
    } else {
      replacement = EMPTY_LIST_ITEMS
    }

    result = result.replace(
      new RegExp(`\\{\\{${sectionName}\\}\\}`, 'g'),
      replacement
    )
  }

  return result
}
```

---

## 6. 前端设计

### 6.1 视图切换组件

**新建文件**：`src/components/ViewSwitcher.tsx`

```typescript
'use client'

import { Briefcase, User, Loader2 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface ViewSwitcherProps {
  currentView: 'leadership' | 'personal'
  onViewChange: (view: 'leadership' | 'personal') => void
  isLoading?: boolean
}

export function ViewSwitcher({ currentView, onViewChange, isLoading }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">视图切换：</span>
      <ToggleGroup type="single" value={currentView} onValueChange={(value) => {
        if (value) onViewChange(value as 'leadership' | 'personal')
      }}>
        <ToggleGroupItem value="leadership" className="gap-2">
          <Briefcase className="h-4 w-4" />
          领导版
        </ToggleGroupItem>
        <ToggleGroupItem value="personal" className="gap-2">
          <User className="h-4 w-4" />
          个人版
        </ToggleGroupItem>
      </ToggleGroup>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  )
}
```

### 6.2 编辑页面集成

**修改文件**：`src/app/edit/[id]/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ViewSwitcher } from '@/components/ViewSwitcher'
import { ExportDialog } from '@/components/ExportDialog'
import { EditorSidebar } from '@/components/EditorSidebar'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { toast } from 'sonner'

export default function EditReportPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [currentView, setCurrentView] = useState<'leadership' | 'personal'>('personal')
  const [isLoading, setIsLoading] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [editorKey, setEditorKey] = useState(0)
  const [aiStyle, setAiStyle] = useState<AIStyle>('detailed')
  
  useEffect(() => {
    fetchReport()
  }, [params.id])
  
  async function fetchReport() {
    const response = await fetch(`/api/reports/${params.id}`)
    const data = await response.json()
    setReport(data)
    setEditorContent(data.content)
    setAiStyle(data.aiStyleOverride || 'detailed')
  }
  
  async function handleViewChange(view: 'leadership' | 'personal') {
    if (view === currentView || !report) return
    
    setIsLoading(true)
    setCurrentView(view)
    
    try {
      // 调用渲染API获取对应视图内容
      const response = await fetch(
        `/api/templates/${report.templateId || 'official-general'}/render?viewType=${view}&date=${report.weekStart}`
      )
      
      if (!response.ok) {
        throw new Error('视图渲染失败')
      }
      
      const data = await response.json()
      
      // 更新编辑器内容
      setEditorContent(data.content)
      setAiStyle(data.aiStyle)
      setEditorKey(k => k + 1)
      
      toast.success(`已切换到${view === 'leadership' ? '领导版' : '个人版'}视图`)
    } catch (error) {
      toast.error('视图切换失败，请重试')
      setCurrentView(currentView)  // 回退到原视图
    } finally {
      setIsLoading(false)
    }
  }
  
  async function handleSave() {
    // 保存完整个人版到数据库
    const response = await fetch(`/api/reports/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editorContent,
        aiStyleOverride: aiStyle
      })
    })
    
    if (response.ok) {
      toast.success('周报已保存')
    } else {
      toast.error('保存失败')
    }
  }
  
  if (!report) return <div>加载中...</div>
  
  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">{report.title}</h1>
          <ViewSwitcher 
            currentView={currentView} 
            onViewChange={handleViewChange}
            isLoading={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <ExportDialog reportId={parseInt(params.id)} />
          <Button onClick={handleSave}>保存</Button>
        </div>
      </div>
      
      {/* 编辑器主体 */}
      <div className="grid grid-cols-[1fr_300px] gap-4">
        <MilkdownEditor 
          key={editorKey} 
          value={editorContent} 
          onChange={setEditorContent}
        />
        
        {/* AI Assistant Sidebar */}
        <EditorSidebar 
          aiStyle={aiStyle} 
          onStyleChange={setAiStyle}
          content={editorContent}
          onContentChange={setEditorContent}
        />
      </div>
    </div>
  )
}
```

### 6.3 导出对话框组件

**新建文件**：`src/components/ExportDialog.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Download, FileText, File } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface ExportDialogProps {
  reportId: number
}

export function ExportDialog({ reportId }: ExportDialogProps) {
  const [selectedView, setSelectedView] = useState<'leadership' | 'personal'>('personal')
  const [exportFormat, setExportFormat] = useState<'markdown' | 'pdf'>('markdown')
  const [isExporting, setIsExporting] = useState(false)
  
  async function handleExport() {
    setIsExporting(true)
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reportId, 
          viewType: selectedView, 
          format: exportFormat 
        })
      })
      
      if (!response.ok) {
        throw new Error('导出失败')
      }
      
      const data = await response.json()
      
      // 根据格式导出
      if (exportFormat === 'markdown') {
        downloadMarkdown(data.content, `周报-${selectedView === 'leadership' ? '领导版' : '个人版'}.md`)
      } else {
        downloadPdf(data.content)
      }
      
      toast.success('导出成功')
    } catch (error) {
      toast.error('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }
  
  function downloadMarkdown(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  
  function downloadPdf(content: string) {
    // TODO: 使用pdf-lib或其他库生成PDF
    toast.info('PDF导出功能即将上线')
  }
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出周报
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>导出周报</DialogTitle>
        <DialogDescription>
          选择导出视图和格式
        </DialogDescription>
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label className="text-base">导出视图</Label>
            <RadioGroup value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="leadership" id="leadership" />
                <Label htmlFor="leadership" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  领导版（精炼汇报，Top3成果）
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personal" id="personal" />
                <Label htmlFor="personal" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  个人版（完整复盘，全量记录）
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label className="text-base">导出格式</Label>
            <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="markdown" id="markdown" />
                <Label htmlFor="markdown" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Markdown (.md)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  PDF (.pdf)
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <Button onClick={handleExport} disabled={isExporting} className="w-full">
            {isExporting ? '导出中...' : '确认导出'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 7. 兼容性与迁移

### 7.1 向后兼容策略

**旧模板兼容**：
- 无viewConfigs字段的旧模板，默认使用personal视图配置（全量section、无过滤）
- 渲染API参数viewType可选，默认值为'personal'
- extractViewConfig函数提供兜底默认配置

**旧周报兼容**：
- 旧周报在编辑页面打开时，默认显示personal视图（完整内容）
- 用户可切换到leadership视图实时预览，但数据库内容不变
- 导出功能完全兼容旧周报（重新渲染即可）

**P2事件标记兼容**：
- rawEvents表新增pitfall和pending类型，但默认值仍为routine
- 旧事件数据无需重新标记，可直接使用
- 事件标记页面支持新类型（下拉选项增加"踩坑记录"、"问题沉淀")

**旧事件处理**：
- 旧事件sectionType默认routine，自动归类到日常事务section
- 用户可在事件标记页面重新标记为pitfall或pending

### 7.2 Migration策略（零数据库改动）

**无需Migration文件**：
- P1阶段已预留config字段（JSON类型），直接扩展viewConfigs子属性
- SectionType枚举扩展仅需修改TypeScript类型定义，不影响数据库
- rawEvents表的sectionType字段已支持字符串类型，新值自动兼容

**官方模板更新方式**：
- 修改official-templates.ts代码预设viewConfigs
- 无需执行数据库migration或手动更新模板记录
- 用户选择官方模板时，自动获得预设配置

**测试兼容性**：
- P0-P3所有功能测试继续通过
- 新增视图切换测试（验证切换不影响数据库）
- 新增导出测试（验证两种视图可独立导出）

---

## 8. 测试策略

### 8.1 单元测试

**新建测试文件**：`src/lib/template/render.test.ts`（扩展）

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'
import { RawEvent } from '@/lib/db/schema'

describe('renderTemplate with enabledSections', () => {
  it('should remove disabled sections from leadership view', () => {
    const template = `## 核心成果\n{{核心成果}}\n## 日常事务\n{{日常事务}}\n## 下周计划\n{{下周计划}}`
    const result = renderTemplate(template, {
      enabledSections: ['achievement', 'plan']  // 只启用核心成果和下周计划
    })
    
    expect(result).toContain('## 核心成果')
    expect(result).toContain('## 下周计划')
    expect(result).not.toContain('## 日常事务')
    expect(result).not.toContain('{{日常事务}}')
  })
  
  it('should apply maxItems for leadership view achievement section', () => {
    const template = '## 核心成果\n{{核心成果}}'
    const events: RawEvent[] = [
      { id: 1, eventTime: new Date('2026-07-01'), source: 'test', content: '事件1', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, eventTime: new Date('2026-07-02'), source: 'test', content: '事件2', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 3, eventTime: new Date('2026-07-03'), source: 'test', content: '事件3', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 4, eventTime: new Date('2026-07-04'), source: 'test', content: '事件4', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ]
    
    const result = renderTemplate(template, {
      events,
      enabledSections: ['achievement'],
      sectionConfig: {
        achievement: { maxItems: 3, autoSort: true, filterTrivial: false }
      }
    })
    
    const lines = result.split('\n').filter(l => l.startsWith('- '))
    expect(lines.length).toBe(3)
  })
  
  it('should filter trivial events for leadership view', () => {
    const template = '## 核心成果\n{{核心成果}}'
    const events: RawEvent[] = [
      { id: 1, eventTime: new Date('2026-07-01'), source: 'test', content: '重要功能开发', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, eventTime: new Date('2026-07-02'), source: 'test', content: 'fix typo', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ]
    
    const result = renderTemplate(template, {
      events,
      enabledSections: ['achievement'],
      sectionConfig: {
        achievement: { filterTrivial: true }
      }
    })
    
    expect(result).toContain('重要功能开发')
    expect(result).not.toContain('fix typo')
  })
  
  it('should render all sections for personal view by default', () => {
    const template = `## 核心成果\n{{核心成果}}\n## 踩坑记录\n{{踩坑记录}}`
    const events: RawEvent[] = [
      { id: 1, eventTime: new Date('2026-07-01'), source: 'test', content: '成果1', sectionType: 'achievement', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, eventTime: new Date('2026-07-02'), source: 'test', content: '踩坑1', sectionType: 'pitfall', status: 'pending', createdAt: new Date(), updatedAt: new Date() },
    ]
    
    const result = renderTemplate(template, {
      events,
      enabledSections: ['achievement', 'pitfall']  // 个人版包含所有section
    })
    
    expect(result).toContain('## 核心成果')
    expect(result).toContain('## 踩坑记录')
    expect(result).toContain('成果1')
    expect(result).toContain('踩坑1')
  })
})
```

**新建测试文件**：`src/lib/template/view-config.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { extractViewConfig } from './view-config'
import { TemplateConfig } from '@/lib/db/schema'

describe('extractViewConfig', () => {
  it('should return leadership config for viewType=leadership', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['achievement', 'risk', 'plan'],
          sectionConfig: {
            achievement: { maxItems: 3, autoSort: true, filterTrivial: true },
            risk: { maxItems: 3, autoSort: true, filterTrivial: true },
            plan: { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['achievement', 'risk', 'routine', 'plan', 'pitfall', 'pending'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
    
    const config = extractViewConfig(templateConfig, 'leadership')
    
    expect(config.enabledSections).toEqual(['achievement', 'risk', 'plan'])
    expect(config.enabledSections).not.toContain('routine')
    expect(config.aiStyle).toBe('formal')
    expect(config.sectionConfig.achievement.maxItems).toBe(3)
  })
  
  it('should return personal config for viewType=personal', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['achievement', 'risk', 'plan'],
          sectionConfig: {},
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['achievement', 'risk', 'routine', 'plan', 'pitfall', 'pending'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
    
    const config = extractViewConfig(templateConfig, 'personal')
    
    expect(config.enabledSections).toContain('pitfall')
    expect(config.enabledSections).toContain('pending')
    expect(config.aiStyle).toBe('detailed')
  })
  
  it('should fallback to default config if template has no viewConfigs', () => {
    const config = extractViewConfig({}, 'leadership')
    
    expect(config.enabledSections).toEqual(['achievement', 'risk', 'plan'])
    expect(config.aiStyle).toBe('formal')
  })
  
  it('should fallback to default personal config for old templates', () => {
    const config = extractViewConfig({}, 'personal')
    
    expect(config.enabledSections).toContain('pitfall')
    expect(config.enabledSections).toContain('pending')
    expect(config.aiStyle).toBe('detailed')
  })
})
```

### 8.2 前端组件测试

**新建测试文件**：`src/components/ViewSwitcher.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewSwitcher } from './ViewSwitcher'

describe('ViewSwitcher', () => {
  it('should render two toggle buttons', () => {
    const mockChange = vi.fn()
    render(<ViewSwitcher currentView="personal" onViewChange={mockChange} />)
    
    expect(screen.getByText('领导版')).toBeInTheDocument()
    expect(screen.getByText('个人版')).toBeInTheDocument()
  })
  
  it('should highlight current view', () => {
    const mockChange = vi.fn()
    render(<ViewSwitcher currentView="leadership" onViewChange={mockChange} />)
    
    const leadershipButton = screen.getByText('领导版').closest('button')
    expect(leadershipButton).toHaveAttribute('data-state', 'on')
  })
  
  it('should call onViewChange when clicked', () => {
    const mockChange = vi.fn()
    render(<ViewSwitcher currentView="personal" onViewChange={mockChange} />)
    
    fireEvent.click(screen.getByText('领导版'))
    expect(mockChange).toHaveBeenCalledWith('leadership')
  })
  
  it('should show loading spinner when isLoading is true', () => {
    const mockChange = vi.fn()
    render(<ViewSwitcher currentView="personal" onViewChange={mockChange} isLoading={true} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()  // Loader2 has role="status"
  })
})
```

**新建测试文件**：`src/components/ExportDialog.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog } from './ExportDialog'

// Mock fetch
global.fetch = vi.fn()

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should render export button', () => {
    render(<ExportDialog reportId={1} />)
    
    expect(screen.getByText('导出周报')).toBeInTheDocument()
  })
  
  it('should show view selection radio group when opened', async () => {
    const user = userEvent.setup()
    render(<ExportDialog reportId={1} />)
    
    await user.click(screen.getByText('导出周报'))
    
    await waitFor(() => {
      expect(screen.getByText('领导版（精炼汇报，Top3成果）')).toBeInTheDocument()
      expect(screen.getByText('个人版（完整复盘，全量记录）')).toBeInTheDocument()
    })
  })
  
  it('should show format selection radio group', async () => {
    const user = userEvent.setup()
    render(<ExportDialog reportId={1} />)
    
    await user.click(screen.getByText('导出周报'))
    
    await waitFor(() => {
      expect(screen.getByText('Markdown (.md)')).toBeInTheDocument()
      expect(screen.getByText('PDF (.pdf)')).toBeInTheDocument()
    })
  })
  
  it('should call export API with selected view and format', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'test content', viewType: 'leadership' })
    } as any)
    
    render(<ExportDialog reportId={1} />)
    
    await user.click(screen.getByText('导出周报'))
    await waitFor(() => screen.getByText('领导版（精炼汇报，Top3成果）'))
    
    await user.click(screen.getByText('领导版（精炼汇报，Top3成果）'))
    await user.click(screen.getByText('确认导出'))
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: 1, viewType: 'leadership', format: 'markdown' })
      })
    })
  })
})
```

### 8.3 API集成测试

**测试命令**：

```bash
# 测试领导版渲染
curl "http://localhost:3000/api/templates/official-general/render?viewType=leadership&date=2026-07-05T00:00:00Z"

# 验证返回：
# {
#   "content": "## 本周完成\n...\n## 核心成果\n...\n## 问题与风险\n...\n## 下周计划\n...",
#   "viewType": "leadership",
#   "aiStyle": "formal"
# }
# 注意：不包含"日常事务"、"踩坑记录"、"问题沉淀"等section

# 测试个人版渲染
curl "http://localhost:3000/api/templates/official-general/render?viewType=personal&date=2026-07-05T00:00:00Z"

# 验证返回：
# {
#   "content": "...包含所有6个section...",
#   "viewType": "personal",
#   "aiStyle": "detailed"
# }

# 测试导出API（领导版）
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d '{"reportId": 1, "viewType": "leadership", "format": "markdown"}'

# 验证：返回领导版渲染内容
```

### 8.4 兼容性测试

**测试场景**：

1. **旧模板渲染**：
   - 选择无viewConfigs的旧模板
   - 验证默认使用personal视图渲染（全量section）
   - 切换到leadership视图，验证仍可渲染（使用兜底配置）

2. **旧周报编辑**：
   - 打开旧周报（无templateId）
   - 验证视图切换按钮可用
   - 切换视图后内容正确显示
   - 保存后数据库内容仍为完整个人版

3. **旧事件标记**：
   - 打开事件标记页面
   - 验证新增pitfall和pending类型选项
   - 验证旧事件默认routine类型仍可正常显示

---

## 9. 未来扩展（架构预留）

### 9.1 P5阶段可扩展方向

**用户自定义视图配置**：
- 前端新增视图配置管理页面（`/templates/[id]/view-config`）
- 用户可调整maxItems（如改为Top5成果）
- 用户可启用/禁用特定section（如领导版也包含日常事务）
- 用户可自定义AI风格映射
- 数据结构已预留（viewConfigs字段），无需重构

**新增第三种视图类型**：
- 如"团队协作版"、"项目汇报版"、"季度总结版"
- TemplateConfig.viewConfigs增加新key即可（如`team`）
- 前端视图切换按钮增加新选项
- 渲染引擎无需修改，复用现有逻辑

**Section级别AI风格**：
- 当前：全局AIStyle（formal/detailed）
- 未来：每个section可独立配置风格（核心成果用concise，问题风险用detailed）
- ViewConfig结构支持扩展：`sectionConfig: { achievement: { ..., aiStyle: 'concise' } }`

**导出格式增强**：
- 当前：Markdown/PDF
- 未来：Word (.docx)、HTML、邮件格式、微信格式
- 导出API结构已预留format参数，易于扩展

**视图模板分离**（长期规划）：
- 如需彻底分离模板结构（领导版和个人版用不同模板）
- 可扩展TemplateConfig支持viewTemplateIds字段
- 当前数据结构兼容此扩展，无技术债

### 9.2 架构优势总结

✅ **零技术债**：数据结构设计合理，未来扩展无需重构核心逻辑  
✅ **渐进式开放**：P4不提供配置界面，后续按需逐步开放功能  
✅ **向后兼容**：所有扩展保持与P0-P3兼容，旧模板/周报自动适配  
✅ **开发成本低**：P4仅实现核心功能（视图切换+导出），后续扩展增量开发  
✅ **架构正确**：视图配置与模板绑定，不同模板可有差异化视图参数  

---

## 10. 实施计划

### 10.1 开发任务拆解

**Phase 1: 数据层与配置（预估2小时）**
- Task 1: 扩展schema.ts类型定义（SectionType、ViewConfig）
- Task 2: 新建view-config.ts视图配置提取函数
- Task 3: 修改official-templates.ts预设viewConfigs

**Phase 2: 渲染引擎扩展（预估3小时）**
- Task 4: 修改render.ts增加enabledSections参数
- Task 5: 实现removeSection函数（移除未启用section）
- Task 6: 编写render.test.ts单元测试

**Phase 3: API扩展（预估2小时）**
- Task 7: 修改/api/templates/[id]/render增加viewType参数
- Task 8: 新建/api/export导出API
- Task 9: 编写API集成测试

**Phase 4: 前端组件（预估4小时）**
- Task 10: 新建ViewSwitcher组件
- Task 11: 新建ExportDialog组件
- Task 12: 修改编辑页面集成视图切换
- Task 13: 编写组件单元测试

**Phase 5: 测试与验证（预估2小时）**
- Task 14: 兼容性测试（旧模板、旧周报）
- Task 15: E2E测试（完整流程验证）
- Task 16: 性能测试（视图切换响应时间）

**总计预估**：13小时（约2个工作日）

### 10.2 里程碑验收

**Milestone 1（Phase 1-2完成）**：
- ✅ 类型定义扩展完成
- ✅ 渲染引擎支持enabledSections
- ✅ 单元测试通过（render.test.ts + view-config.test.ts）

**Milestone 2（Phase 3完成）**：
- ✅ API支持viewType参数
- ✅ 导出API可用
- ✅ API集成测试通过

**Milestone 3（Phase 4完成）**：
- ✅ 前端视图切换可用
- ✅ 导出对话框可用
- ✅ 组件测试通过

**Milestone 4（Phase 5完成 - 最终验收）**：
- ✅ 所有兼容性测试通过
- ✅ E2E测试通过（完整流程验证）
- ✅ 性能达标（视图切换响应时间<500ms）
- ✅ 文档完成（用户使用指南）

---

## 11. 验收标准

### 11.1 功能验收标准

1. **视图切换功能**：
   - 编辑页面显示视图切换按钮（领导版/个人版）
   - 点击切换按钮，编辑器内容实时更新
   - 切换到领导版：内容只包含3个section（核心成果/问题风险/下周计划）
   - 切换到个人版：内容包含所有6个section
   - 领导版AI风格自动切换为formal，个人版为detailed

2. **导出功能**：
   - 导出对话框显示视图选择（领导版/个人版）
   - 导出对话框显示格式选择（Markdown/PDF）
   - 选择领导版导出：生成精炼版Markdown/PDF
   - 选择个人版导出：生成完整版Markdown/PDF

3. **配置预设**：
   - 4套官方模板预设viewConfigs配置
   - 领导版配置：maxItems=3, filterTrivial=true, aiStyle=formal
   - 个人版配置：maxItems=undefined, filterTrivial=false, aiStyle=detailed

4. **数据库不变**：
   - 视图切换不触发数据库写入
   - 保存周报时，数据库始终保存完整个人版内容
   - AI风格可独立保存（aiStyleOverride字段）

### 11.2 技术验收标准

1. **测试覆盖率**：
   - 单元测试覆盖率≥90%（render.ts、view-config.ts）
   - 前端组件测试覆盖率≥85%（ViewSwitcher、ExportDialog）
   - API集成测试覆盖所有场景

2. **性能标准**：
   - 视图切换响应时间<500ms（包含API调用）
   - 导出生成时间<1000ms（Markdown格式）
   - PDF导出时间<3000ms（包含格式转换）

3. **兼容性标准**：
   - 旧模板正常渲染（无viewConfigs时使用默认配置）
   - 旧周报正常编辑（可切换视图，保存功能正常）
   - 旧事件正常显示（sectionType默认routine）

4. **代码质量**：
   - TypeScript类型完整，无编译错误
   - ESLint检查通过，无警告
   - 代码结构清晰，符合项目规范

### 11.3 用户验收标准

1. **易用性**：
   - 视图切换按钮直观易懂（图标+文字标签）
   - 切换过程流畅，无闪烁或卡顿
   - 导出对话框选项清晰（视图差异说明）

2. **功能正确性**：
   - 领导版内容准确精炼（Top3成果、过滤琐碎事件）
   - 个人版内容完整准确（全量记录、包含踩坑沉淀）
   - 导出内容与视图切换预览一致

3. **错误处理**：
   - 视图切换失败时，友好提示并可重试
   - 导出失败时，显示错误原因并可重试
   - 网络错误时，提示用户检查网络连接

---

## 12. 风险与依赖

### 12.1 技术风险

**低风险**：
- 数据层改动极小（仅扩展类型定义，无migration）
- 渲染引擎复用现有逻辑，改动可控
- API扩展参数化设计，易于测试和调试

**中风险**：
- 前端编辑器实时渲染可能需要优化（Milkdown重新渲染性能）
- 需确保视图切换不影响用户编辑内容（避免内容丢失）

**风险缓解**：
- 增加editorKey强制刷新机制，确保编辑器状态同步
- 视图切换前备份当前内容，失败时可回退
- 性能测试验证响应时间，必要时优化API缓存

### 12.2 外部依赖

**无新依赖**：
- P4阶段完全复用现有技术栈（Next.js、Drizzle、React、Tailwind）
- 不引入新的第三方库或服务

**依赖P0-P3**：
- 依赖P1模板变量引擎（renderTemplate函数）
- 依赖P2事件素材库（rawEvents表）
- 依赖P3 AI Enhancement（AIStyle类型、EditorSidebar组件）

### 12.3 约束条件

**技术约束**：
- 本阶段不调用真实AI（AI风格仅配置层，润色功能复用P3）
- 导出PDF功能可延期到后续版本（当前仅支持Markdown）
- 不修改周报保存逻辑（始终保存完整个人版）

**业务约束**：
- P4阶段不开放用户自定义配置（仅官方模板预设）
- 视图类型固定两种（领导版+个人版），不新增第三种
- Section类型固定6种，不扩展更多类型

---

## 13. 成功标准与后续规划

### 13.1 成功标准

**功能完整性**：
- ✅ 支持领导版和个人版两种视图切换
- ✅ 视图切换实时渲染，不影响数据库存储
- ✅ 导出时可选择视图版本
- ✅ 4套官方模板预设配置可用

**技术质量**：
- ✅ 测试覆盖率≥90%（单元测试）
- ✅ 性能达标（视图切换<500ms）
- ✅ 兼容性通过（旧模板/周报正常）
- ✅ 代码质量合格（TypeScript、ESLint）

**用户满意度**：
- ✅ 易用性良好（切换流畅、导出清晰）
- ✅ 功能正确（内容准确、风格匹配）
- ✅ 错误处理完善（友好提示、可重试）

### 13.2 后续规划（P5阶段）

**第一阶段：用户自定义配置**
- 新增视图配置管理页面
- 用户可调整maxItems、启用/禁用section
- 用户可自定义AI风格映射

**第二阶段：扩展视图类型**
- 新增第三种视图（如团队协作版）
- 支持更多导出格式（Word、HTML、邮件格式）

**第三阶段：智能增强**
- AI自动推荐视图类型（根据内容特征）
- Section级别AI风格配置
- 导出格式自动适配（根据使用场景）

---

**设计文档版本**：v1.0  
**创建日期**：2026-07-05  
**作者**：AI Assistant  
**状态**：待用户review  
**预计实施周期**：2个工作日（13小时）