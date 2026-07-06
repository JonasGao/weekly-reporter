# Memo 随手记模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现低摩擦工作记忆沉淀模块，作为 Git 采集的补充，完善记忆沉淀层核心能力。

**Architecture:** 复用 raw_events 表存储所有记录，新增 tags 表管理标签映射。时间线作为首页展示所有记录，周报列表降级为二级页面。采用 Next.js App Router + SQLite + Drizzle ORM + Tailwind CSS。

**Tech Stack:** Next.js 16, TypeScript, SQLite, Drizzle ORM, Tailwind CSS, Lucide React Icons

## Global Constraints

- 数据库：SQLite + Drizzle ORM，复用现有 raw_events 表
- 前端框架：Next.js 16 App Router 模式
- 样式方案：Tailwind CSS，复用现有 UI 组件（shadcn/ui）
- 测试框架：Vitest + Testing Library，所有新增组件需编写单元测试
- 代码规范：遵循现有代码风格，无注释，单一职责原则
- 路由调整：首页从 `/` (周报列表) 移至 `/reports`，新 `/` 渲染时间线

## File Structure

### 数据层文件
```
drizzle/schema.ts              - 新增 tags 表定义
src/lib/db/schema.ts           - 新增 tags 表类型定义，扩展 raw_events 字段
drizzle/migrations/            - 数据库迁移脚本（自动生成）
```

### API 路由文件
```
src/app/api/events/route.ts    - 时间线查询接口（GET）
src/app/api/events/[id]/route.ts - 记录编辑/删除接口（PUT/DELETE）
src/app/api/tags/route.ts      - 标签列表接口（GET/POST）
src/app/api/tags/[id]/route.ts - 标签编辑接口（PUT/DELETE）
src/app/api/tags/stats/route.ts - 标签统计接口（GET）
```

### 页面文件
```
src/app/page.tsx               - 时间线首页（重写）
src/app/reports/page.tsx       - 周报列表页面（新路由）
src/app/tags/page.tsx          - 标签管理页面
```

### 组件文件
```
src/components/QuickInputBar.tsx        - 快速输入框组件
src/components/TimelineView.tsx         - 时间线主体组件
src/components/TimelineGroup.tsx        - 时间线聚合组组件
src/components/EventCard.tsx            - 单条记录卡片组件
src/components/EventEditForm.tsx        - 内联编辑表单组件
src/components/TagFilterPanel.tsx       - 标签筛选面板组件
src/components/ViewSwitcher.tsx         - 视图切换器组件（日/周/月）
src/components/TagList.tsx              - 标签列表组件（表格）
src/components/TagFormDialog.tsx        - 标签编辑对话框组件
src/components/Navigation.tsx           - 新导航栏组件（时间线 | 周报 | 标签 | 模板 | 采集源）
```

### 工具函数文件
```
src/lib/tags/parser.ts         - 标签解析逻辑（#标签语法）
src/lib/tags/mapper.ts         - 标签映射逻辑（tags → sectionType）
src/lib/init-tags.ts           - 内置标签初始化逻辑
```

---

## Task 1: 数据模型扩展

**Files:**
- Modify: `drizzle/schema.ts`
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/tags/parser.ts`
- Create: `src/lib/tags/mapper.ts`
- Create: `src/lib/init-tags.ts`

**Interfaces:**
- Consumes: 现有 `raw_events` 表结构
- Produces: `tags` 表定义、扩展的 `raw_events` 表（新增 `tags` 和 `isImportant` 字段）、标签解析和映射函数

- [ ] **Step 1: 在 drizzle/schema.ts 新增 tags 表定义**

```typescript
// 在文件末尾新增 tags 表定义
export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  sectionType: text('section_type').$type<SectionType>(),
  color: text('color'),
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

- [ ] **Step 2: 在 src/lib/db/schema.ts 新增 tags 类型定义并扩展 raw_events**

```typescript
// 新增 tags 表类型定义
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

// 扩展 raw_events 表，新增 tags 和 isImportant 字段
export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  category: text('category'),
  sectionType: text('section_type').default('routine').notNull().$type<SectionType>(),
  status: text('status').default('pending').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>(),
  isImportant: integer('is_important', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

- [ ] **Step 3: 创建 src/lib/tags/parser.ts 实现标签解析逻辑**

```typescript
const TAG_REGEX = /#([\w\u4e00-\u9fa5]+)/g

export function parseTags(input: string): { content: string; tags: string[] } {
  const tags: string[] = []
  const content = input.replace(TAG_REGEX, (match, tag) => {
    tags.push(tag)
    return ''
  }).trim()
  
  return { content, tags }
}

export function highlightTags(input: string): string {
  return input.replace(TAG_REGEX, '<span class="bg-blue-100 px-1 rounded">#$1</span>')
}
```

- [ ] **Step 4: 创建 src/lib/tags/mapper.ts 实现标签映射逻辑**

```typescript
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { SectionType } from '@/lib/db/schema'

export async function mapTagsToSectionType(tagNames: string[]): Promise<SectionType> {
  if (tagNames.length === 0) return 'routine'
  
  const tagRecords = await db.select()
    .from(tags)
    .where(sql`${tags.name} IN ${tagNames}`)
  
  const priority: SectionType[] = ['achievement', 'risk', 'plan', 'routine']
  
  for (const p of priority) {
    if (tagRecords.some(t => t.sectionType === p)) {
      return p
    }
  }
  
  return 'routine'
}
```

- [ ] **Step 5: 创建 src/lib/init-tags.ts 实现内置标签初始化**

```typescript
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'

const BUILT_IN_TAGS = [
  { name: '工作', sectionType: 'routine', color: 'blue' },
  { name: '成果', sectionType: 'achievement', color: 'green' },
  { name: '风险', sectionType: 'risk', color: 'red' },
  { name: '计划', sectionType: 'plan', color: 'yellow' },
  { name: '会议', sectionType: 'routine', color: 'purple' },
  { name: '重要', sectionType: 'achievement', color: 'orange' },
]

export async function initializeBuiltInTags() {
  const existingTags = await db.select().from(tags)
  
  if (existingTags.length === 0) {
    const now = new Date()
    await db.insert(tags).values(
      BUILT_IN_TAGS.map(t => ({
        ...t,
        isBuiltIn: true,
        createdAt: now,
        updatedAt: now,
      }))
    )
  }
}
```

- [ ] **Step 6: 编写单元测试验证标签解析逻辑**

创建 `src/lib/tags/parser.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { parseTags } from './parser'

describe('parseTags', () => {
  it('should parse single tag', () => {
    const result = parseTags('完成评审 #成果')
    expect(result.content).toBe('完成评审')
    expect(result.tags).toEqual(['成果'])
  })
  
  it('should parse multiple tags', () => {
    const result = parseTags('修复 bug #工作 #风险')
    expect(result.content).toBe('修复 bug')
    expect(result.tags).toEqual(['工作', '风险'])
  })
  
  it('should handle no tags', () => {
    const result = parseTags('纯文本记录')
    expect(result.content).toBe('纯文本记录')
    expect(result.tags).toEqual([])
  })
})
```

- [ ] **Step 7: 运行测试验证标签解析逻辑**

Run: `npm run test src/lib/tags/parser.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: 生成数据库迁移**

Run: `source ~/.nvm/nvm.sh && npm run db:generate`
Expected: 生成迁移文件，包含 tags 表创建和 raw_events 表扩展

- [ ] **Step 9: 执行数据库迁移**

Run: `source ~/.nvm/nvm.sh && npm run db:migrate`
Expected: 迁移成功，数据库包含 tags 表和新字段

- [ ] **Step 10: 在 instrumentation.ts 中调用初始化函数**

Modify `instrumentation.ts`，在启动时调用 `initializeBuiltInTags()`：

```typescript
import { initializeBuiltInTags } from '@/lib/init-tags'

export async function onRequest() {
  await initializeBuiltInTags()
}
```

- [ ] **Step 11: Commit 数据模型扩展**

```bash
git add drizzle/schema.ts src/lib/db/schema.ts src/lib/tags/ instrumentation.ts
git commit -m "feat: add tags table and extend raw_events for memo module"
```

---

## Task 2: API 接口实现 - 时间线查询

**Files:**
- Create: `src/app/api/events/route.ts`
- Test: `src/app/api/events/route.test.ts`

**Interfaces:**
- Consumes: 扩展后的 `raw_events` 表、`parseTags` 和 `mapTagsToSectionType` 函数
- Produces: GET `/api/events` 接口，支持按时间范围、标签筛选、聚合级别查询

- [ ] **Step 1: 编写 GET /api/events 接口测试**

创建 `src/app/api/events/route.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'

describe('GET /api/events', () => {
  it('should return events within date range', async () => {
    const response = await fetch('/api/events?weekStart=2024-01-08&weekEnd=2024-01-14')
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
  
  it('should filter events by tags', async () => {
    const response = await fetch('/api/events?tags=工作,会议')
    const data = await response.json()
    expect(response.status).toBe(200)
  })
})
```

- [ ] **Step 2: 运行测试验证接口不存在**

Run: `npm run test src/app/api/events/route.test.ts`
Expected: FAIL (接口未实现)

- [ ] **Step 3: 实现 GET /api/events 接口**

创建 `src/app/api/events/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { desc, and, between, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('weekStart')
  const weekEnd = searchParams.get('weekEnd')
  const tagsParam = searchParams.get('tags')
  const status = searchParams.get('status') || 'pending'
  
  let query = db.select().from(rawEvents)
    .where(rawEvents.status.eq(status))
    .orderBy(desc(rawEvents.eventTime))
  
  if (weekStart && weekEnd) {
    const start = new Date(weekStart)
    const end = new Date(weekEnd)
    query = query.where(between(rawEvents.eventTime, start, end))
  }
  
  if (tagsParam) {
    const tags = tagsParam.split(',')
    query = query.where(sql`${rawEvents.tags} LIKE ANY ${tags}`)
  }
  
  const events = await query
  return NextResponse.json(events)
}
```

- [ ] **Step 4: 运行测试验证接口通过**

Run: `npm run test src/app/api/events/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit API 接口**

```bash
git add src/app/api/events/
git commit -m "feat: add GET /api/events endpoint for timeline query"
```

---

## Task 3: API 接口实现 - 记录创建/编辑/删除

**Files:**
- Modify: `src/app/api/events/route.ts` (新增 POST)
- Create: `src/app/api/events/[id]/route.ts` (PUT/DELETE)
- Test: `src/app/api/events/[id]/route.test.ts`

**Interfaces:**
- Consumes: `parseTags` 和 `mapTagsToSectionType` 函数
- Produces: POST `/api/events`（创建记录）、PUT `/api/events/[id]`（编辑记录）、DELETE `/api/events/[id]`（删除记录）

- [ ] **Step 1: 编写 POST /api/events 接口测试**

在 `src/app/api/events/route.test.ts` 新增测试：

```typescript
it('should create new memo event with tags', async () => {
  const response = await fetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      content: '完成评审 #成果 #工作',
      eventTime: new Date().toISOString(),
    }),
  })
  const data = await response.json()
  expect(response.status).toBe(201)
  expect(data.tags).toEqual(['成果', '工作'])
  expect(data.sectionType).toBe('achievement')
})
```

- [ ] **Step 2: 实现 POST /api/events 接口**

在 `src/app/api/events/route.ts` 新增 POST handler：

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { content, eventTime } = body
  
  const { content: cleanContent, tags } = parseTags(content)
  const sectionType = await mapTagsToSectionType(tags)
  
  const now = new Date()
  const newEvent = await db.insert(rawEvents).values({
    content: cleanContent,
    tags,
    eventTime: new Date(eventTime || now),
    source: 'manual',
    sectionType,
    status: 'pending',
    isImportant: false,
    createdAt: now,
    updatedAt: now,
  }).returning()
  
  return NextResponse.json(newEvent[0], { status: 201 })
}
```

- [ ] **Step 3: 运行测试验证 POST 接口**

Run: `npm run test src/app/api/events/route.test.ts`
Expected: PASS (新增测试通过)

- [ ] **Step 4: 编写 PUT/DELETE /api/events/[id] 接口测试**

创建 `src/app/api/events/[id]/route.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'

describe('PUT /api/events/[id]', () => {
  it('should update event content and tags', async () => {
    const response = await fetch('/api/events/1', {
      method: 'PUT',
      body: JSON.stringify({
        content: '更新后的内容 #会议',
        isImportant: true,
      }),
    })
    expect(response.status).toBe(200)
  })
})

describe('DELETE /api/events/[id]', () => {
  it('should delete manual event', async () => {
    const response = await fetch('/api/events/1', { method: 'DELETE' })
    expect(response.status).toBe(204)
  })
})
```

- [ ] **Step 5: 实现 PUT /api/events/[id] 接口**

创建 `src/app/api/events/[id]/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { parseTags } from '@/lib/tags/parser'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const body = await request.json()
  
  const event = await db.select().from(rawEvents).where(eq(rawEvents.id, id))
  if (event.length === 0) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  
  let updateData: any = { updatedAt: new Date() }
  
  if (body.content) {
    const { content, tags } = parseTags(body.content)
    updateData.content = content
    updateData.tags = tags
  }
  
  if (body.eventTime) {
    updateData.eventTime = new Date(body.eventTime)
  }
  
  if (body.isImportant !== undefined) {
    updateData.isImportant = body.isImportant
  }
  
  const updated = await db.update(rawEvents)
    .set(updateData)
    .where(eq(rawEvents.id, id))
    .returning()
  
  return NextResponse.json(updated[0])
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  
  const event = await db.select().from(rawEvents).where(eq(rawEvents.id, id))
  if (event.length === 0 || event[0].source !== 'manual') {
    return NextResponse.json(
      { error: 'Cannot delete non-manual event' },
      { status: 403 }
    )
  }
  
  await db.delete(rawEvents).where(eq(rawEvents.id, id))
  return NextResponse.json(null, { status: 204 })
}
```

- [ ] **Step 6: 运行测试验证 PUT/DELETE 接口**

Run: `npm run test src/app/api/events/[id]/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit 记录操作 API**

```bash
git add src/app/api/events/
git commit -m "feat: add POST/PUT/DELETE /api/events endpoints for memo CRUD"
```

---

## Task 4: API 接口实现 - 标签管理

**Files:**
- Create: `src/app/api/tags/route.ts` (GET/POST)
- Create: `src/app/api/tags/[id]/route.ts` (PUT/DELETE)
- Create: `src/app/api/tags/stats/route.ts` (GET)
- Test: `src/app/api/tags/route.test.ts`

**Interfaces:**
- Consumes: `tags` 表
- Produces: 标签 CRUD 接口、标签使用统计接口

- [ ] **Step 1: 编写标签管理接口测试**

创建 `src/app/api/tags/route.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'

describe('GET /api/tags', () => {
  it('should return all tags', async () => {
    const response = await fetch('/api/tags')
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})

describe('POST /api/tags', () => {
  it('should create new tag', async () => {
    const response = await fetch('/api/tags', {
      method: 'POST',
      body: JSON.stringify({
        name: '新标签',
        sectionType: 'routine',
        color: 'cyan',
      }),
    })
    expect(response.status).toBe(201)
  })
})
```

- [ ] **Step 2: 实现 GET/POST /api/tags 接口**

创建 `src/app/api/tags/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'

export async function GET() {
  const allTags = await db.select().from(tags)
  return NextResponse.json(allTags)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, sectionType, color } = body
  
  const now = new Date()
  const newTag = await db.insert(tags).values({
    name,
    sectionType,
    color,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  }).returning()
  
  return NextResponse.json(newTag[0], { status: 201 })
}
```

- [ ] **Step 3: 运行测试验证 GET/POST 接口**

Run: `npm run test src/app/api/tags/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 4: 实现 PUT/DELETE /api/tags/[id] 接口**

创建 `src/app/api/tags/[id]/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tags } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const body = await request.json()
  
  const tag = await db.select().from(tags).where(eq(tags.id, id))
  if (tag.length === 0) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }
  
  const updated = await db.update(tags)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(tags.id, id))
    .returning()
  
  return NextResponse.json(updated[0])
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  
  const tag = await db.select().from(tags).where(eq(tags.id, id))
  if (tag.length === 0 || tag[0].isBuiltIn) {
    return NextResponse.json(
      { error: 'Cannot delete built-in tag' },
      { status: 403 }
    )
  }
  
  await db.delete(tags).where(eq(tags.id, id))
  return NextResponse.json(null, { status: 204 })
}
```

- [ ] **Step 5: 实现 GET /api/tags/stats 统计接口**

创建 `src/app/api/tags/stats/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rawEvents, tags } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function GET() {
  const stats = await db.execute(sql`
    SELECT t.name, t.color, COUNT(*) as usage_count
    FROM tags t
    LEFT JOIN raw_events e ON json_contains(e.tags, json_quote(t.name))
    GROUP BY t.id
    ORDER BY usage_count DESC
  `)
  
  return NextResponse.json(stats.rows)
}
```

- [ ] **Step 6: Commit 标签管理 API**

```bash
git add src/app/api/tags/
git commit -m "feat: add tags CRUD and stats API endpoints"
```

---

## Task 5: 快速输入组件实现

**Files:**
- Create: `src/components/QuickInputBar.tsx`
- Test: `src/components/QuickInputBar.test.tsx`

**Interfaces:**
- Consumes: `parseTags` 函数、POST `/api/events` 接口
- Produces: QuickInputBar 组件，单行输入框 + 回车保存 + 标签高亮

- [ ] **Step 1: 编写 QuickInputBar 组件测试**

创建 `src/components/QuickInputBar.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { QuickInputBar } from './QuickInputBar'

describe('QuickInputBar', () => {
  it('should render input with placeholder', () => {
    render(<QuickInputBar onSuccess={vi.fn()} />)
    expect(screen.getByPlaceholderText(/记录工作内容/)).toBeInTheDocument()
  })
  
  it('should submit on Enter and clear input', async () => {
    const onSuccess = vi.fn()
    render(<QuickInputBar onSuccess={onSuccess} />)
    
    const input = screen.getByRole('textbox')
    await userEvent.type(input, '完成评审 #成果{enter}')
    
    expect(input.value).toBe('')
    expect(onSuccess).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试验证组件不存在**

Run: `npm run test src/components/QuickInputBar.test.tsx`
Expected: FAIL (组件未实现)

- [ ] **Step 3: 实现 QuickInputBar 组件**

创建 `src/components/QuickInputBar.tsx`：

```typescript
'use client'

import { useState, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface QuickInputBarProps {
  onSuccess?: () => void
}

export function QuickInputBar({ onSuccess }: QuickInputBarProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const handleSubmit = async () => {
    if (!input.trim()) return
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: input,
          eventTime: new Date().toISOString(),
        }),
      })
      
      if (response.ok) {
        setInput('')
        toast.success('已记录')
        onSuccess?.()
      }
    } catch (error) {
      toast.error('记录失败')
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
  }
  
  return (
    <div className="mb-6">
      <Input
        ref={inputRef}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="记录工作内容，使用 #标签 分类..."
        className="w-full"
      />
    </div>
  )
}
```

- [ ] **Step 4: 运行测试验证组件通过**

Run: `npm run test src/components/QuickInputBar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit 快速输入组件**

```bash
git add src/components/QuickInputBar.tsx src/components/QuickInputBar.test.tsx
git commit -m "feat: add QuickInputBar component for memo input"
```

---

## Task 6: 时间线核心组件实现

**Files:**
- Create: `src/components/ViewSwitcher.tsx`
- Create: `src/components/TimelineGroup.tsx`
- Create: `src/components/EventCard.tsx`
- Create: `src/components/TimelineView.tsx`
- Test: `src/components/EventCard.test.tsx`

**Interfaces:**
- Consumes: GET `/api/events` 接口
- Produces: 时间线展示组件，支持日/周/月聚合切换、记录卡片展示

- [ ] **Step 1: 编写 ViewSwitcher 组件测试**

创建 `src/components/ViewSwitcher.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { ViewSwitcher } from './ViewSwitcher'

describe('ViewSwitcher', () => {
  it('should render three buttons', () => {
    render(<ViewSwitcher value="day" onChange={vi.fn()} />)
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('周')).toBeInTheDocument()
    expect(screen.getByText('月')).toBeInTheDocument()
  })
  
  it('should call onChange when clicked', async () => {
    const onChange = vi.fn()
    render(<ViewSwitcher value="day" onChange={onChange} />)
    
    await userEvent.click(screen.getByText('周'))
    expect(onChange).toHaveBeenCalledWith('week')
  })
})
```

- [ ] **Step 2: 实现 ViewSwitcher 组件**

创建 `src/components/ViewSwitcher.tsx`：

```typescript
'use client'

import { Button } from '@/components/ui/button'

interface ViewSwitcherProps {
  value: 'day' | 'week' | 'month'
  onChange: (value: 'day' | 'week' | 'month') => void
}

export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  const views: { key: 'day' | 'week' | 'month'; label: string }[] = [
    { key: 'day', label: '日' },
    { key: 'week', label: '周' },
    { key: 'month', label: '月' },
  ]
  
  return (
    <div className="flex gap-2 mb-4">
      {views.map(view => (
        <Button
          key={view.key}
          variant={value === view.key ? 'default' : 'outline'}
          onClick={() => onChange(view.key)}
        >
          {view.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 编写 EventCard 组件测试**

创建 `src/components/EventCard.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { EventCard } from './EventCard'
import { RawEvent } from '@/lib/db/schema'

describe('EventCard', () => {
  const mockEvent: RawEvent = {
    id: 1,
    content: '完成评审',
    tags: ['成果', '工作'],
    eventTime: new Date(),
    source: 'manual',
    sectionType: 'achievement',
    status: 'pending',
    isImportant: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  it('should render content and tags', () => {
    render(<EventCard event={mockEvent} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('完成评审')).toBeInTheDocument()
    expect(screen.getByText('#成果')).toBeInTheDocument()
    expect(screen.getByText('#工作')).toBeInTheDocument()
  })
  
  it('should show important marker if isImportant', () => {
    const importantEvent = { ...mockEvent, isImportant: true }
    render(<EventCard event={importantEvent} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByTestId('important-marker')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: 实现 EventCard 组件**

创建 `src/components/EventCard.tsx`：

```typescript
'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, Trash2, Star } from 'lucide-react'
import { RawEvent } from '@/lib/db/schema'
import { formatDistanceToNow } from 'date-fns'

interface EventCardProps {
  event: RawEvent
  onEdit: (event: RawEvent) => void
  onDelete: (id: number) => void
}

export function EventCard({ event, onEdit, onDelete }: EventCardProps) {
  const timeLabel = formatDistanceToNow(event.eventTime, { addSuffix: true })
  
  return (
    <Card className="p-4 mb-2">
      <div className="flex items-start gap-2">
        {event.isImportant && (
          <div data-testid="important-marker" className="w-2 h-2 rounded-full bg-yellow-500" />
        )}
        <div className="flex-1">
          <p className="text-sm">{event.content}</p>
          <div className="flex gap-1 mt-2">
            {event.tags?.map(tag => (
              <Badge key={tag} variant="secondary">#{tag}</Badge>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{timeLabel}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => onEdit(event)}>
                <Edit2 className="h-3 w-3" />
              </Button>
              {event.source === 'manual' && (
                <Button variant="ghost" size="icon" onClick={() => onDelete(event.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 5: 运行测试验证组件通过**

Run: `npm run test src/components/EventCard.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: 实现 TimelineGroup 组件**

创建 `src/components/TimelineGroup.tsx`：

```typescript
'use client'

import { RawEvent } from '@/lib/db/schema'
import { EventCard } from './EventCard'
import { format } from 'date-fns'

interface TimelineGroupProps {
  title: string
  events: RawEvent[]
  onEdit: (event: RawEvent) => void
  onDelete: (id: number) => void
}

export function TimelineGroup({ title, events, onEdit, onDelete }: TimelineGroupProps) {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-3 text-lg">{title}</h3>
      <div className="space-y-2">
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 实现 TimelineView 组件**

创建 `src/components/TimelineView.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { RawEvent } from '@/lib/db/schema'
import { ViewSwitcher } from './ViewSwitcher'
import { TimelineGroup } from './TimelineGroup'
import { format, startOfWeek, startOfMonth } from 'date-fns'

export function TimelineView() {
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [events, setEvents] = useState<RawEvent[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetchEvents()
  }, [])
  
  const fetchEvents = async () => {
    const response = await fetch('/api/events')
    const data = await response.json()
    setEvents(data)
    setLoading(false)
  }
  
  const groupEventsByTime = (events: RawEvent[], mode: 'day' | 'week' | 'month') => {
    const groups: Record<string, RawEvent[]> = {}
    
    events.forEach(event => {
      const date = new Date(event.eventTime)
      let key: string
      
      if (mode === 'day') {
        key = format(date, 'yyyy-MM-dd EEEE')
      } else if (mode === 'week') {
        key = `W${format(date, 'w')} (${format(startOfWeek(date), 'MM-dd')} ~ ${format(date, 'MM-dd')})`
      } else {
        key = format(startOfMonth(date), 'yyyy年MM月')
      }
      
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })
    
    return Object.entries(groups).map(([title, events]) => ({ title, events }))
  }
  
  const handleEdit = (event: RawEvent) => {
    // TODO: 打开编辑对话框
  }
  
  const handleDelete = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    fetchEvents()
  }
  
  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }
  
  const groupedEvents = groupEventsByTime(events, viewMode)
  
  return (
    <div>
      <ViewSwitcher value={viewMode} onChange={setViewMode} />
      <div className="space-y-4">
        {groupedEvents.map(({ title, events }) => (
          <TimelineGroup
            key={title}
            title={title}
            events={events}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Commit 时间线核心组件**

```bash
git add src/components/ViewSwitcher.tsx src/components/TimelineGroup.tsx src/components/EventCard.tsx src/components/TimelineView.tsx src/components/*.test.tsx
git commit -m "feat: add timeline core components (ViewSwitcher, EventCard, TimelineGroup, TimelineView)"
```

---

## Task 7: 标签筛选面板实现

**Files:**
- Create: `src/components/TagFilterPanel.tsx`
- Test: `src/components/TagFilterPanel.test.tsx`

**Interfaces:**
- Consumes: GET `/api/tags/stats` 接口、GET `/api/events` 接口
- Produces: TagFilterPanel 组件，标签列表 + 多选筛选 + 使用次数统计

- [ ] **Step 1: 编写 TagFilterPanel 组件测试**

创建 `src/components/TagFilterPanel.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '@/test/utils'
import { TagFilterPanel } from './TagFilterPanel'

describe('TagFilterPanel', () => {
  it('should render tag list with counts', async () => {
    render(<TagFilterPanel selectedTags={[]} onChange={vi.fn()} />)
    expect(await screen.findByText('#工作')).toBeInTheDocument()
  })
  
  it('should toggle tag selection on click', async () => {
    const onChange = vi.fn()
    render(<TagFilterPanel selectedTags={[]} onChange={onChange} />)
    
    const tagCheckbox = await screen.findByRole('checkbox', { name: /工作/ })
    await userEvent.click(tagCheckbox)
    
    expect(onChange).toHaveBeenCalledWith(['工作'])
  })
})
```

- [ ] **Step 2: 实现 TagFilterPanel 组件**

创建 `src/components/TagFilterPanel.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'

interface TagStats {
  name: string
  color: string
  usage_count: number
}

interface TagFilterPanelProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
}

export function TagFilterPanel({ selectedTags, onChange }: TagFilterPanelProps) {
  const [tagStats, setTagStats] = useState<TagStats[]>([])
  
  useEffect(() => {
    fetchTagStats()
  }, [])
  
  const fetchTagStats = async () => {
    const response = await fetch('/api/tags/stats')
    const data = await response.json()
    setTagStats(data)
  }
  
  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter(t => t !== tagName))
    } else {
      onChange([...selectedTags, tagName])
    }
  }
  
  const clearSelection = () => {
    onChange([])
  }
  
  return (
    <div className="w-48 p-4 border-l">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">标签筛选</h3>
        {selectedTags.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            清除
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {tagStats.map(stat => (
          <div key={stat.name} className="flex items-center gap-2">
            <Checkbox
              checked={selectedTags.includes(stat.name)}
              onCheckedChange={() => toggleTag(stat.name)}
            />
            <Link href="/tags">
              <Badge variant="outline" className="cursor-pointer">
                #{stat.name}
              </Badge>
            </Link>
            <span className="text-xs text-muted-foreground">{stat.usage_count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 运行测试验证组件通过**

Run: `npm run test src/components/TagFilterPanel.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit 标签筛选面板**

```bash
git add src/components/TagFilterPanel.tsx src/components/TagFilterPanel.test.tsx
git commit -m "feat: add TagFilterPanel component for tag filtering"
```

---

## Task 8: 时间线首页实现与路由调整

**Files:**
- Modify: `src/app/page.tsx` (重写为时间线首页)
- Create: `src/app/reports/page.tsx` (周报列表页面)
- Create: `src/components/Navigation.tsx`

**Interfaces:**
- Consumes: QuickInputBar、TimelineView、TagFilterPanel 组件
- Produces: 时间线首页、周报列表二级页面、新导航栏

- [ ] **Step 1: 创建新导航栏组件**

创建 `src/components/Navigation.tsx`：

```typescript
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { path: '/', label: '时间线' },
  { path: '/reports', label: '周报' },
  { path: '/tags', label: '标签' },
  { path: '/templates', label: '模板' },
  { path: '/collect', label: '采集源' },
]

export function Navigation() {
  const pathname = usePathname()
  
  return (
    <nav className="flex gap-4 border-b py-4">
      {NAV_ITEMS.map(item => (
        <Link key={item.path} href={item.path}>
          <Button variant={pathname === item.path ? 'default' : 'ghost'}>
            {item.label}
          </Button>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: 重写首页为时间线页面**

修改 `src/app/page.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { QuickInputBar } from '@/components/QuickInputBar'
import { TimelineView } from '@/components/TimelineView'
import { TagFilterPanel } from '@/components/TagFilterPanel'
import { Navigation } from '@/components/Navigation'

export default function Home() {
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  
  const handleMemoSuccess = () => {
    setRefreshKey(prev => prev + 1)
  }
  
  return (
    <main className="container mx-auto py-8 px-4">
      <Navigation />
      <div className="mt-6 flex">
        <div className="flex-1">
          <QuickInputBar onSuccess={handleMemoSuccess} />
          <TimelineView key={refreshKey} />
        </div>
        <TagFilterPanel selectedTags={selectedTags} onChange={setSelectedTags} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: 创建周报列表二级页面**

创建 `src/app/reports/page.tsx`：

```typescript
'use client'

import { ReportList } from '@/components/ReportList'
import { Navigation } from '@/components/Navigation'

export default function ReportsPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <Navigation />
      <div className="mt-6">
        <ReportList />
      </div>
    </main>
  )
}
```

- [ ] **Step 4: 调整布局组件，添加 Navigation**

修改 `src/app/layout.tsx`，确保所有页面共享导航：

```typescript
// 保持现有 layout 结构，仅在需要时添加 Navigation
// 大部分页面已在各自页面中引入 Navigation，layout 保持不变
```

- [ ] **Step 5: Commit 路由调整**

```bash
git add src/app/page.tsx src/app/reports/page.tsx src/components/Navigation.tsx
git commit -m "feat: move reports to /reports, set timeline as new homepage"
```

---

## Task 9: 标签管理页面实现

**Files:**
- Create: `src/app/tags/page.tsx`
- Create: `src/components/TagList.tsx`
- Create: `src/components/TagFormDialog.tsx`
- Test: `src/components/TagList.test.tsx`

**Interfaces:**
- Consumes: GET/POST/PUT/DELETE `/api/tags` 接口
- Produces: 标签管理页面、标签列表表格、编辑对话框

- [ ] **Step 1: 编写 TagList 组件测试**

创建 `src/components/TagList.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { TagList } from './TagList'
import { Tag } from '@/lib/db/schema'

describe('TagList', () => {
  const mockTags: Tag[] = [
    { id: 1, name: '工作', sectionType: 'routine', color: 'blue', isBuiltIn: true, createdAt: new Date(), updatedAt: new Date() },
  ]
  
  it('should render tag table', () => {
    render(<TagList tags={mockTags} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('工作')).toBeInTheDocument()
    expect(screen.getByText('routine')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 实现 TagList 组件**

创建 `src/components/TagList.tsx`：

```typescript
'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit2, Trash2 } from 'lucide-react'
import { Tag } from '@/lib/db/schema'

interface TagListProps {
  tags: Tag[]
  onEdit: (tag: Tag) => void
  onDelete: (id: number) => void
}

export function TagList({ tags, onEdit, onDelete }: TagListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>标签名</TableHead>
          <TableHead>映射分类</TableHead>
          <TableHead>颜色</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags.map(tag => (
          <TableRow key={tag.id}>
            <TableCell>
              <Badge variant="outline" style={{ borderColor: tag.color }}>
                #{tag.name}
              </Badge>
            </TableCell>
            <TableCell>{tag.sectionType || 'routine'}</TableCell>
            <TableCell>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: tag.color }} />
            </TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(tag)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                {!tag.isBuiltIn && (
                  <Button variant="ghost" size="icon" onClick={() => onDelete(tag.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 3: 实现 TagFormDialog 组件**

创建 `src/components/TagFormDialog.tsx`：

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Tag, SectionType } from '@/lib/db/schema'

interface TagFormDialogProps {
  open: boolean
  onClose: () => void
  tag?: Tag
  onSave: (data: { name: string; sectionType: SectionType; color: string }) => void
}

const COLORS = ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'cyan', 'pink', 'gray', 'black']
const SECTION_TYPES: SectionType[] = ['achievement', 'risk', 'routine', 'plan']

export function TagFormDialog({ open, onClose, tag, onSave }: TagFormDialogProps) {
  const [name, setName] = useState(tag?.name || '')
  const [sectionType, setSectionType] = useState<SectionType>(tag?.sectionType || 'routine')
  const [color, setColor] = useState(tag?.color || 'blue')
  
  const handleSave = () => {
    onSave({ name, sectionType, color })
    onClose()
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? '编辑标签' : '新建标签'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="标签名称"
          />
          <Select value={sectionType} onValueChange={setSectionType}>
            {SECTION_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button
                key={c}
                className={`w-6 h-6 rounded ${color === c ? 'ring-2' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: 实现标签管理页面**

创建 `src/app/tags/page.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/Navigation'
import { TagList } from '@/components/TagList'
import { TagFormDialog } from '@/components/TagFormDialog'
import { Tag, SectionType } from '@/lib/db/schema'
import { Plus } from 'lucide-react'

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | undefined>()
  
  useEffect(() => {
    fetchTags()
  }, [])
  
  const fetchTags = async () => {
    const response = await fetch('/api/tags')
    const data = await response.json()
    setTags(data)
  }
  
  const handleCreate = () => {
    setEditingTag(undefined)
    setDialogOpen(true)
  }
  
  const handleEdit = (tag: Tag) => {
    setEditingTag(tag)
    setDialogOpen(true)
  }
  
  const handleDelete = async (id: number) => {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    fetchTags()
  }
  
  const handleSave = async (data: { name: string; sectionType: SectionType; color: string }) => {
    if (editingTag) {
      await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    }
    fetchTags()
  }
  
  return (
    <main className="container mx-auto py-8 px-4">
      <Navigation />
      <div className="mt-6">
        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">标签管理</h1>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新建标签
          </Button>
        </div>
        <TagList tags={tags} onEdit={handleEdit} onDelete={handleDelete} />
        <TagFormDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          tag={editingTag}
          onSave={handleSave}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: 运行测试验证组件**

Run: `npm run test src/components/TagList.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit 标签管理页面**

```bash
git add src/app/tags/ src/components/TagList.tsx src/components/TagFormDialog.tsx src/components/TagList.test.tsx
git commit -m "feat: add tags management page with CRUD operations"
```

---

## Task 10: 周报生成集成调整

**Files:**
- Modify: `src/app/api/reports/route.ts` (调整周报生成逻辑，支持 tags 映射)
- Modify: `src/lib/template/render.ts` (调整渲染逻辑，支持带 tags 的记录)

**Interfaces:**
- Consumes: GET `/api/events` 接口、`mapTagsToSectionType` 函数
- Produces: 周报生成流程调整，自动根据 tags 映射 sectionType

- [ ] **Step 1: 调整周报生成接口**

修改 `src/app/api/reports/route.ts`，在创建周报时自动导入素材：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { between } from 'drizzle-orm'
import { mapTagsToSectionType } from '@/lib/tags/mapper'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { weekStart, weekEnd, templateId } = body
  
  // 查询本周素材
  const events = await db.select()
    .from(rawEvents)
    .where(between(rawEvents.eventTime, new Date(weekStart), new Date(weekEnd)))
    .where(rawEvents.status.eq('pending'))
  
  // 为每条记录映射 sectionType
  const processedEvents = await Promise.all(
    events.map(async event => {
      if (event.tags && event.tags.length > 0) {
        const sectionType = await mapTagsToSectionType(event.tags)
        return { ...event, sectionType }
      }
      return event
    })
  )
  
  // 按模板渲染周报内容（保持现有渲染逻辑）
  const template = await db.select()
    .from(templates)
    .where(eq(templates.id, templateId))
  
  const content = await renderTemplate(template[0], processedEvents)
  
  // 创建周报
  const report = await db.insert(reports).values({
    title: `${weekStart} ~ ${weekEnd} 周报`,
    content,
    weekStart,
    weekEnd,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  // 更新素材状态
  await db.update(rawEvents)
    .set({ status: 'processed' })
    .where(between(rawEvents.eventTime, new Date(weekStart), new Date(weekEnd)))
  
  return NextResponse.json(report[0], { status: 201 })
}
```

- [ ] **Step 2: 测试周报生成接口**

运行现有测试确保周报生成逻辑正常：

Run: `npm run test src/app/api/reports/route.test.ts`
Expected: PASS

- [ ] **Step 3: Commit 周报生成集成**

```bash
git add src/app/api/reports/route.ts src/lib/template/render.ts
git commit -m "feat: integrate memo tags mapping into report generation"
```

---

## Task 11: 全量测试与验收

**Files:**
- Modify: 各组件测试文件

**Interfaces:**
- Consumes: 所有已实现的功能
- Produces: 全量测试通过，功能验收完成

- [ ] **Step 1: 运行全量测试**

Run: `npm run test`
Expected: 所有测试 PASS

- [ ] **Step 2: 运行类型检查**

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 3: 启动开发服务器验证功能**

Run: `source ~/.nvm/nvm.sh && npm run dev`

手动验收：
- 访问 `/` 验证时间线首页
- 输入框记录 Memo，验证 #标签解析
- 切换日/周/月视图，验证聚合逻辑
- 点击标签筛选，验证筛选功能
- 访问 `/tags` 验证标签管理页面
- 访问 `/reports` 验证周报列表页面
- 创建周报，验证素材自动导入

- [ ] **Step 4: Commit 最终验收**

```bash
git add .
git commit -m "feat: complete memo module implementation with full testing"
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-05-memo-module.md`.**

## 执行选项

**1. Subagent-Driven (推荐)** - 我为每个任务派发独立的 subagent，任务间可审查，快速迭代

**2. Inline Execution** - 在本会话中使用 executing-plans 技能，批量执行并在检查点审查

**选择哪种执行方式？**