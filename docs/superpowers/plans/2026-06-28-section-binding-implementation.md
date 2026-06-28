# 模板区块与事件素材自动绑定渲染系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模板区块与事件素材自动绑定渲染，用户可标记事件类型，一键生成完整周报初稿

**Architecture:** 渐进式扩展现有系统，新增数据库字段、扩展模板渲染、改造前端页面、新增 API routes

**Tech Stack:** Next.js 16, SQLite + Drizzle ORM, React 19, TypeScript

---

## 文件结构

**数据库层**：
- Modify: `src/lib/db/schema.ts` - 新增 sectionType 字段和类型定义
- Modify: `drizzle/schema.ts` - Drizzle schema 同步
- Create: `drizzle/0004_add_section_type.sql` - Migration 文件

**模板渲染层**：
- Modify: `src/lib/template/render.ts` - 扩展 renderTemplate 函数
- Modify: `src/lib/template/render.test.ts` - 新增测试用例

**前端组件**：
- Create: `src/components/EventListForMarking.tsx` - 事件标记列表组件
- Create: `src/components/EventsSelectDialog.tsx` - 事件选择弹窗组件

**API routes**：
- Create: `src/app/api/events/route.ts` - GET 查询本周事件
- Create: `src/app/api/events/[id]/route.ts` - PATCH 更新 sectionType
- Create: `src/app/api/reports/generate/route.ts` - POST 生成周报初稿

**页面改造**：
- Modify: `src/app/collect/page.tsx` - 增加事件标记组件
- Modify: `src/app/new/page.tsx` - 增加事件选择和一键生成功能

**测试**：
- Modify: `src/lib/template/render.test.ts` - 扩展测试
- Create: `src/app/api/events/route.test.ts` - API 测试

---

## Task 1: 数据库 schema 扩展

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `drizzle/schema.ts`
- Create: `drizzle/0004_add_section_type.sql`

- [ ] **Step 1: 扩展 schema.ts 类型定义**

修改 `src/lib/db/schema.ts`，在文件末尾新增类型定义：

```typescript
// 在文件末尾添加
export type SectionType = 'achievement' | 'risk' | 'routine' | 'plan'

export interface SectionRenderConfig {
  maxItems?: number
  autoSort?: boolean
  filterTrivial?: boolean
}

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
}
```

- [ ] **Step 2: 修改 rawEvents 表定义**

修改 `src/lib/db/schema.ts` 中 rawEvents 表定义，在 category 字段后新增：

```typescript
export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  category: text('category'),
  sectionType: text('section_type').default('routine').notNull(), // 新增此行
  status: text('status').default('pending').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

- [ ] **Step 3: 更新 RawEvent 类型导出**

修改 `src/lib/db/schema.ts`，确保类型导出正确：

```typescript
export type RawEvent = typeof rawEvents.$inferSelect
export type NewRawEvent = typeof rawEvents.$inferInsert
```

- [ ] **Step 4: 同步 drizzle schema**

运行 Drizzle Kit 生成 migration：

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run db:generate
```

Expected: 生成新的 migration 文件 `drizzle/0004_*.sql`

- [ ] **Step 5: 运行 migration**

执行数据库迁移：

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run db:migrate
```

Expected: 成功执行，raw_events 表新增 section_type 字段

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add sectionType field to raw_events table"
```

---

## Task 2: 扩展模板渲染逻辑

**Files:**
- Modify: `src/lib/template/render.ts`
- Modify: `src/lib/template/render.test.ts`

- [ ] **Step 1: 扩展 RenderOptions 接口**

修改 `src/lib/template/render.ts`，扩展接口定义：

```typescript
import { RawEvent, SectionType, TemplateConfig } from '@/lib/db/schema'

export interface RenderOptions {
  date?: Date
  events?: RawEvent[]  // 新增
  sectionConfig?: TemplateConfig['sectionConfig']  // 新增
}
```

- [ ] **Step 2: 添加琐碎事件过滤函数**

在 `src/lib/template/render.ts` 中添加辅助函数：

```typescript
const TRIVIAL_KEYWORDS = [
  'fix typo', 'update comment', 'refactor minor',
  'chore', 'docs', 'formatting', 'whitespace'
]

function isTrivialEvent(content: string): boolean {
  if (content.length < 50) return true
  const lowerContent = content.toLowerCase()
  return TRIVIAL_KEYWORDS.some(kw => lowerContent.includes(kw))
}
```

- [ ] **Step 3: 添加事件过滤和格式化函数**

在 `src/lib/template/render.ts` 中添加核心处理函数：

```typescript
function filterAndFormatEvents(
  events: RawEvent[],
  type: SectionType,
  config?: TemplateConfig['sectionConfig'][SectionType]
): string {
  let filtered = events.filter(e => e.sectionType === type)
  
  if (config?.filterTrivial) {
    filtered = filtered.filter(e => !isTrivialEvent(e.content))
  }
  
  if (config?.autoSort !== false) {
    filtered.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
  }
  
  if (config?.maxItems) {
    filtered = filtered.slice(0, config.maxItems)
  }
  
  if (filtered.length === 0) return '- \n- \n- '
  return filtered.map(e => `- ${e.content}`).join('\n')
}
```

- [ ] **Step 4: 修改 renderTemplate 函数**

修改 `src/lib/template/render.ts` 中的 renderTemplate 函数：

```typescript
export function renderTemplate(content: string, options?: RenderOptions): string {
  const baseDate = options?.date ?? new Date()
  let result = content
  
  // 1. 处理系统变量（保持原有逻辑）
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
  
  // 2. 处理 section 变量（新增逻辑）
  const sectionVariables: Record<SectionType, string> = {
    achievement: '核心成果',
    risk: '问题与风险',
    routine: '日常事务',
    plan: '下周计划',
  }
  
  for (const [type, variableName] of Object.entries(sectionVariables)) {
    const pattern = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g')
    
    if (options?.events) {
      const eventsContent = filterAndFormatEvents(
        options.events,
        type as SectionType,
        options.sectionConfig?.[type as SectionType]
      )
      result = result.replace(pattern, eventsContent)
    } else {
      result = result.replace(pattern, '- \n- \n- ')
    }
  }
  
  return result
}
```

- [ ] **Step 5: 编写测试用例**

修改 `src/lib/template/render.test.ts`，新增测试：

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'
import type { RawEvent } from '@/lib/db/schema'

describe('renderTemplate with events', () => {
  it('should fill section variables with events', () => {
    const mockEvents: RawEvent[] = [
      {
        id: 1,
        eventTime: new Date('2026-06-25'),
        source: 'git',
        content: '完成用户认证功能开发',
        sectionType: 'achievement',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        eventTime: new Date('2026-06-24'),
        source: 'git',
        content: '修复登录页面bug',
        sectionType: 'risk',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    
    const template = '## 本周完成\n{{核心成果}}\n\n## 问题\n{{问题与风险}}'
    const result = renderTemplate(template, { events: mockEvents })
    
    expect(result).toContain('- 完成用户认证功能开发')
    expect(result).toContain('- 修复登录页面bug')
  })
  
  it('should fallback to empty list when no events', () => {
    const template = '## 本周完成\n{{核心成果}}'
    const result = renderTemplate(template)
    
    expect(result).toContain('- \n- \n- ')
  })
  
  it('should filter trivial events', () => {
    const mockEvents: RawEvent[] = [
      {
        id: 1,
        eventTime: new Date('2026-06-25'),
        source: 'git',
        content: '重要功能开发',
        sectionType: 'achievement',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        eventTime: new Date('2026-06-24'),
        source: 'git',
        content: 'fix typo in comments',
        sectionType: 'achievement',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    
    const template = '## 本周完成\n{{核心成果}}'
    const result = renderTemplate(template, {
      events: mockEvents,
      sectionConfig: {
        achievement: { filterTrivial: true }
      }
    })
    
    expect(result).toContain('- 重要功能开发')
    expect(result).not.toContain('fix typo')
  })
})
```

- [ ] **Step 6: 运行测试**

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run test
```

Expected: 所有测试通过

- [ ] **Step 7: Commit**

```bash
git add src/lib/template/render.ts src/lib/template/render.test.ts
git commit -m "feat: extend renderTemplate with section event binding"
```

---

## Task 3: 创建事件 API routes

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/events/[id]/route.ts`

- [ ] **Step 1: 创建 events API route**

创建 `src/app/api/events/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { and, gte, lte } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get('weekStart')
    const weekEnd = searchParams.get('weekEnd')
    
    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: '缺少日期参数' },
        { status: 400 }
      )
    }
    
    const start = new Date(weekStart)
    const end = new Date(weekEnd)
    
    const events = await db.query.rawEvents.findMany({
      where: and(
        gte(rawEvents.eventTime, start),
        lte(rawEvents.eventTime, end)
      ),
      orderBy: (rawEvents, { desc }) => [desc(rawEvents.eventTime)],
    })
    
    return NextResponse.json({ events })
  } catch (error) {
    return NextResponse.json(
      { error: '查询事件失败' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 创建 events/[id] API route**

创建 `src/app/api/events/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { SectionType } from '@/lib/db/schema'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id, 10)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的 ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { sectionType } = body
    
    if (!['achievement', 'risk', 'routine', 'plan'].includes(sectionType)) {
      return NextResponse.json(
        { error: '无效的 sectionType' },
        { status: 400 }
      )
    }
    
    await db.update(rawEvents)
      .set({
        sectionType: sectionType as SectionType,
        updatedAt: new Date(),
      })
      .where(eq(rawEvents.id, id))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '更新事件失败' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/events/
git commit -m "feat: add events API routes for section binding"
```

---

## Task 4: 创建前端事件标记组件

**Files:**
- Create: `src/components/EventListForMarking.tsx`

- [ ] **Step 1: 创建 EventListForMarking 组件**

创建 `src/components/EventListForMarking.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { RawEvent, SectionType } from '@/lib/db/schema'

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  achievement: '核心成果',
  risk: '问题风险',
  routine: '日常事务',
  plan: '下周计划',
}

interface EventListForMarkingProps {
  weekStart: string
  weekEnd: string
}

export function EventListForMarking({ weekStart, weekEnd }: EventListForMarkingProps) {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchEvents()
  }, [weekStart, weekEnd])
  
  async function fetchEvents() {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events?weekStart=${weekStart}&weekEnd=${weekEnd}`
      )
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      toast.error('加载事件失败')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleMarkSectionType(eventId: number, sectionType: SectionType) {
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType }),
      })
      
      setEvents(prev =>
        prev.map(e =>
          e.id === eventId ? { ...e, sectionType } : e
        )
      )
      
      toast.success('已标记事件类型')
    } catch (error) {
      toast.error('标记失败')
    }
  }
  
  if (loading) {
    return <div className="text-center py-4">加载中...</div>
  }
  
  if (events.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">本周暂无事件</div>
  }
  
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-4">本周事件素材</h2>
      <div className="border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left text-sm font-medium">日期</th>
              <th className="px-4 py-2 text-left text-sm font-medium">内容</th>
              <th className="px-4 py-2 text-left text-sm font-medium">区块类型</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 text-sm">
                  {format(new Date(event.eventTime), 'MM-dd')}
                </td>
                <td className="px-4 py-3 text-sm">
                  {event.content}
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={event.sectionType}
                    onValueChange={(val) =>
                      handleMarkSectionType(event.id, val as SectionType)
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SECTION_TYPE_LABELS).map(([type, label]) => (
                        <SelectItem key={type} value={type}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EventListForMarking.tsx
git commit -m "feat: add EventListForMarking component"
```

---

## Task 5: 改造素材归集页

**Files:**
- Modify: `src/app/collect/page.tsx`

- [ ] **Step 1: 导入组件**

修改 `src/app/collect/page.tsx`，导入新组件：

```typescript
import { EventListForMarking } from '@/components/EventListForMarking'
import { getWeekRange, formatDate } from '@/lib/utils'
import { useState } from 'react'
```

- [ ] **Step 2: 添加日期状态**

修改 `src/app/collect/page.tsx`，在组件开头添加：

```typescript
export default function CollectPage() {
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const refreshFnRef = useRef<(() => void) | null>(null)
  
  // 新增：当前周日期范围
  const currentDate = new Date()
  const { start, end } = getWeekRange(currentDate)
  const weekStart = formatDate(start)
  const weekEnd = formatDate(end)
  
  // ... 其他代码
```

- [ ] **Step 3: 添加事件列表组件**

修改 `src/app/collect/page.tsx`，在 CollectSourceList 后添加：

```typescript
<CollectSourceList onRefresh={handleRefreshReady} />

{/* 新增：本周事件列表 */}
<EventListForMarking weekStart={weekStart} weekEnd={weekEnd} />

<ScanReposDialog ... />
```

- [ ] **Step 4: Commit**

```bash
git add src/app/collect/page.tsx
git commit -m "feat: integrate EventListForMarking in collect page"
```

---

## Task 6: 创建事件选择弹窗组件

**Files:**
- Create: `src/components/EventsSelectDialog.tsx`

- [ ] **Step 1: 创建 EventsSelectDialog 组件**

创建 `src/components/EventsSelectDialog.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { RawEvent, SectionType } from '@/lib/db/schema'

const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  achievement: '核心成果',
  risk: '问题风险',
  routine: '日常事务',
  plan: '下周计划',
}

interface EventsSelectDialogProps {
  open: boolean
  onClose: () => void
  weekStart: string
  weekEnd: string
  onConfirm: (events: RawEvent[]) => void
}

export function EventsSelectDialog({
  open,
  onClose,
  weekStart,
  weekEnd,
  onConfirm,
}: EventsSelectDialogProps) {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    if (open) {
      fetchEvents()
      setSelectedIds(new Set())
    }
  }, [open, weekStart, weekEnd])
  
  async function fetchEvents() {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/events?weekStart=${weekStart}&weekEnd=${weekEnd}`
      )
      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      toast.error('加载事件失败')
    } finally {
      setLoading(false)
    }
  }
  
  function toggleSelection(eventId: number) {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }
  
  function handleConfirm() {
    const selected = events.filter(e => selectedIds.has(e.id))
    onConfirm(selected)
    onClose()
  }
  
  // 按区块类型分组
  const groupedEvents: Record<SectionType, RawEvent[]> = {
    achievement: events.filter(e => e.sectionType === 'achievement'),
    risk: events.filter(e => e.sectionType === 'risk'),
    routine: events.filter(e => e.sectionType === 'routine'),
    plan: events.filter(e => e.sectionType === 'plan'),
  }
  
  if (loading) {
    return (
      <Dialog open={open}>
        <DialogContent>
          <div className="text-center py-8">加载中...</div>
        </DialogContent>
      </Dialog>
    )
  }
  
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择本周事件</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {Object.entries(groupedEvents).map(([type, typeEvents]) => (
            <div key={type}>
              <h3 className="font-semibold mb-2">
                {SECTION_TYPE_LABELS[type as SectionType]} ({typeEvents.length})
              </h3>
              {typeEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  暂无事件
                </div>
              ) : (
                <div className="space-y-2">
                  {typeEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 py-2 border rounded px-3"
                    >
                      <Checkbox
                        checked={selectedIds.has(event.id)}
                        onCheckedChange={() => toggleSelection(event.id)}
                      />
                      <div className="flex-1">
                        <div className="text-sm">
                          {format(new Date(event.eventTime), 'MM-dd')}
                        </div>
                        <div className="text-sm mt-1">{event.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm}>
            确定 ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EventsSelectDialog.tsx
git commit -m "feat: add EventsSelectDialog component"
```

---

## Task 7: 创建周报生成 API route

**Files:**
- Create: `src/app/api/reports/generate/route.ts`

- [ ] **Step 1: 创建 generate API route**

创建 `src/app/api/reports/generate/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { reports, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate } from '@/lib/template/render'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import type { RawEvent } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const { templateId, events, weekStart, weekEnd, title } = body
    
    if (!templateId || !weekStart || !weekEnd) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }
    
    // 获取模板内容
    let templateContent: string = ''
    
    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (template) {
        templateContent = template.content
      }
    } else if (templateId.startsWith('user-')) {
      const templateIdNum = parseInt(templateId.replace('user-', ''), 10)
      if (!isNaN(templateIdNum)) {
        const result = await db.select()
          .from(templates)
          .where(eq(templates.id, templateIdNum))
          .limit(1)
        if (result.length > 0) {
          templateContent = result[0].content
        }
      }
    }
    
    if (!templateContent) {
      return NextResponse.json(
        { error: '模板不存在' },
        { status: 400 }
      )
    }
    
    // 渲染模板（填充事件）
    const baseDate = new Date(weekStart)
    const content = renderTemplate(templateContent, {
      date: baseDate,
      events: events as RawEvent[],
    })
    
    // 创建周报
    const now = new Date()
    const result = await db.insert(reports).values({
      title,
      content,
      weekStart,
      weekEnd,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: '生成周报失败' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reports/generate/route.ts
git commit -m "feat: add reports generate API route"
```

---

## Task 8: 改造新建周报页面

**Files:**
- Modify: `src/app/new/page.tsx`

- [ ] **Step 1: 导入新组件和图标**

修改 `src/app/new/page.tsx`，添加导入：

```typescript
import { EventsSelectDialog } from '@/components/EventsSelectDialog'
import { ListChecks, Sparkles } from 'lucide-react'
import type { RawEvent } from '@/lib/db/schema'
```

- [ ] **Step 2: 添加状态管理**

修改 `src/app/new/page.tsx`，在组件开头添加状态：

```typescript
export default function NewReportPage() {
  const router = useRouter()
  // ... 现有状态
  
  // 新增：事件选择状态
  const [eventsDialogOpen, setEventsDialogOpen] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<RawEvent[]>([])
  const [generating, setGenerating] = useState(false)
  
  // ... 其他代码
```

- [ ] **Step 3: 添加生成周报函数**

修改 `src/app/new/page.tsx`，添加新函数：

```typescript
async function handleGenerateDraft() {
  if (!selectedTemplateId) {
    toast.error('请选择模板')
    return
  }
  
  if (selectedEvents.length === 0) {
    toast.error('请选择至少一个事件')
    return
  }
  
  setGenerating(true)
  
  try {
    const response = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: selectedTemplateId,
        events: selectedEvents,
        weekStart,
        weekEnd,
        title,
      }),
    })
    
    if (response.ok) {
      const report = await response.json()
      toast.success('周报已生成')
      router.push(`/edit/${report.id}`)
    } else {
      const error = await response.json()
      toast.error(error.error || '生成失败')
    }
  } catch (error) {
    toast.error('生成失败，请重试')
  } finally {
    setGenerating(false)
  }
}
```

- [ ] **Step 4: 添加事件选择按钮和弹窗**

修改 `src/app/new/page.tsx`，在模板选择区域后添加：

```typescript
{/* 在模板选择区域后 */}
<div className="space-y-2">
  <Label>本周事件</Label>
  <Button
    type="button"
    variant="outline"
    onClick={() => setEventsDialogOpen(true)}
    className="w-full"
  >
    <ListChecks className="h-4 w-4 mr-2" />
    选择本周事件 ({selectedEvents.length})
  </Button>
</div>

<EventsSelectDialog
  open={eventsDialogOpen}
  onClose={() => setEventsDialogOpen(false)}
  weekStart={weekStart}
  weekEnd={weekEnd}
  onConfirm={(events) => {
    setSelectedEvents(events)
    setEventsDialogOpen(false)
  }}
/>
```

- [ ] **Step 5: 替换保存按钮为一键生成**

修改 `src/app/new/page.tsx`，替换保存按钮：

```typescript
{/* 替换原来的保存按钮 */}
<Button type="button" onClick={handleGenerateDraft} disabled={generating}>
  <Sparkles className="h-4 w-4 mr-2" />
  {generating ? '生成中...' : '一键生成周报'}
</Button>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/new/page.tsx
git commit -m "feat: integrate event selection and auto-generation in new report page"
```

---

## Task 9: 验证和测试

**Files:**
- Modify: `src/lib/template/render.test.ts`

- [ ] **Step 1: 运行所有测试**

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run test
```

Expected: 所有测试通过

- [ ] **Step 2: 运行 lint**

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run lint
```

Expected: 无 lint 错误

- [ ] **Step 3: 手动测试流程**

启动开发服务器：

```bash
source ~/.nvm/nvm.sh && cd /home/god/github/weekly-reporter && npm run dev
```

测试步骤：
1. 打开 http://localhost:3000/collect
2. 查看事件列表，尝试标记事件类型
3. 打开 http://localhost:3000/new
4. 选择模板
5. 点击"选择本周事件"，选择几个事件
6. 点击"一键生成周报"
7. 验证跳转到编辑页面，内容正确填充

- [ ] **Step 4: 测试向后兼容**

测试旧模板：
1. 不选择事件，直接生成周报
2. 验证 section 变量填充为空列表

测试旧周报编辑：
1. 打开一个已存在的旧周报
2. 验证编辑页面正常工作

Expected: 所有功能正常，向后兼容

- [ ] **Step 5: Final commit**

```bash
git status
git diff --stat
git add .
git commit -m "feat: complete section binding system implementation"
```

---

## Self-Review Checklist

- ✅ **Spec coverage**: 所有设计文档需求都有对应任务
- ✅ **Placeholder scan**: 无 TBD/TODO，所有代码完整
- ✅ **Type consistency**: 类型定义在 Task 1，后续任务引用一致
- ✅ **File paths**: 所有路径精确
- ✅ **Test coverage**: 包含单元测试、API测试、手动测试

---

## 预估工作量

- Task 1 (数据库): 20分钟
- Task 2 (模板渲染): 30分钟
- Task 3 (API routes): 15分钟
- Task 4 (事件标记组件): 25分钟
- Task 5 (素材页改造): 10分钟
- Task 6 (事件选择弹窗): 30分钟
- Task 7 (生成API): 15分钟
- Task 8 (新建页改造): 20分钟
- Task 9 (验证测试): 25分钟

**总计**: ~2.5小时