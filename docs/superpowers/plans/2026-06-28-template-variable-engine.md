# P1 Template Variable Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-side template variable rendering engine with 9 built-in variables and frontend toolbar for manual insertion.

**Architecture:** Single rendering function (`renderTemplate`) handles all variable substitution via regex. Two API endpoints trigger rendering: POST /api/reports (create) and GET /api/templates/[id]/render (preview). Frontend toolbar allows manual variable insertion.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, SQLite, Vitest, React Testing Library, date-fns

---

## File Structure

### New Files (Create)
- `src/lib/template/render.ts` - Core rendering function
- `src/lib/template/render.test.ts` - Rendering function unit tests
- `src/components/VariableToolbar.tsx` - Frontend toolbar component
- `src/components/VariableToolbar.test.tsx` - Toolbar component tests
- `src/app/api/templates/[id]/render/route.ts` - Template preview API endpoint
- `drizzle/0002_add_template_config.sql` - Database migration
- `src/app/new/page.test.tsx` - New report page tests
- `src/app/edit/[id]/page.test.tsx` - Edit report page tests

### Modified Files (Modify)
- `src/lib/db/schema.ts` - Add config field to templates table
- `src/app/api/reports/route.ts` - Add templateId parameter handling
- `src/app/new/page.tsx` - Integrate VariableToolbar
- `src/app/edit/[id]/page.tsx` - Integrate VariableToolbar

---

## Task 1: Database Schema Extension

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0002_add_template_config.sql`

### Step 1: Add config field to schema

Modify `src/lib/db/schema.ts` to add config field and type definition:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  weekStart: text('week_start').notNull(),
  weekEnd: text('week_end').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  config: text('config', { mode: 'json' }).notNull().default({}), // NEW FIELD
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// NEW TYPE DEFINITION
export interface TemplateConfig {
  sectionSkeleton?: {
    type: 'unordered' | 'ordered' | 'task'
    placeholderCount: number
  }
}

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert

export interface CollectSourceConfig {
  baseUrl?: string
  owner: string
  repo?: string
  token?: string
  authorEmails: string[]
  branch?: string
}

export const collectSources = sqliteTable('collect_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).notNull().$type<CollectSourceConfig>(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastSyncStatus: text('last_sync_status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type CollectSource = typeof collectSources.$inferSelect
export type NewCollectSource = typeof collectSources.$inferInsert

export interface RawEventMetadata {
  sha?: string
  url?: string
  repo?: string
}

export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  category: text('category'),
  status: text('status').default('pending').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type RawEvent = typeof rawEvents.$inferSelect
export type NewRawEvent = typeof rawEvents.$inferInsert
```

- [ ] **Step 2: Create migration SQL file**

Create `drizzle/0002_add_template_config.sql`:

```sql
ALTER TABLE `templates` ADD COLUMN `config` text NOT NULL DEFAULT '{}';
```

- [ ] **Step 3: Generate and run migration**

Run the following commands:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected output: Migration executed successfully, config field added.

- [ ] **Step 4: Verify migration**

Run this command to check database schema:

```bash
sqlite3 .data/db.sqlite "PRAGMA table_info(templates);"
```

Expected output: Should show all columns including new `config` column with type `text` and default value `{}`.

- [ ] **Step 5: Commit schema changes**

```bash
git add src/lib/db/schema.ts drizzle/0002_add_template_config.sql
git commit -m "feat: add config field to templates schema with migration"
```

---

## Task 2: Core Rendering Function (TDD)

**Files:**
- Create: `src/lib/template/render.ts`
- Create: `src/lib/template/render.test.ts`

### Step 1: Write failing test for system variables

Create `src/lib/template/render.test.ts` with first test:

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'

describe('renderTemplate', () => {
  it('should replace {{本周日期范围}} with correct date range', () => {
    const content = '{{本周日期范围}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toBe('2026.06.22 - 2026.06.28')
  })
  
  it('should replace {{当前周数}} with correct week number', () => {
    const content = '{{当前周数}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toBe('第27周')
  })
  
  it('should replace {{年份}} with correct year', () => {
    const content = '{{年份}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toBe('2026')
  })
  
  it('should replace {{月份}} with correct month', () => {
    const content = '{{月份}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toBe('6月')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test src/lib/template/render.test.ts`

Expected: FAIL with error "Cannot find module './render'"

- [ ] **Step 3: Create render.ts with minimal implementation**

Create `src/lib/template/render.ts`:

```typescript
import { format, startOfWeek, endOfWeek, getWeek, getYear, getMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RenderOptions {
  date?: Date
}

export function renderTemplate(content: string, options: RenderOptions = {}): string {
  const baseDate = options.date || new Date()
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })

  let result = content

  result = result.replace(
    /{{本周日期范围}}/g,
    `${format(weekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(weekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  )
  
  result = result.replace(/{{当前周数}}/g, `第${getWeek(baseDate, { weekStartsOn: 1 })}周`)
  result = result.replace(/{{年份}}/g, String(getYear(baseDate)))
  result = result.replace(/{{月份}}/g, `${getMonth(baseDate) + 1}月`)

  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (4 tests passing)

- [ ] **Step 5: Add test for {{上周日期范围}}**

Add test to `src/lib/template/render.test.ts`:

```typescript
it('should replace {{上周日期范围}} with last week range relative to base date', () => {
  const content = '{{上周日期范围}}'
  const result = renderTemplate(content, { date: new Date('2026-06-27') })
  
  expect(result).toBe('2026.06.15 - 2026.06.21')
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test src/lib/template/render.test.ts`

Expected: FAIL - {{上周日期范围}} not replaced

- [ ] **Step 7: Implement {{上周日期范围}} handling**

Update `src/lib/template/render.ts`:

```typescript
import { format, startOfWeek, endOfWeek, subWeeks, getWeek, getYear, getMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RenderOptions {
  date?: Date
}

export function renderTemplate(content: string, options: RenderOptions = {}): string {
  const baseDate = options.date || new Date()
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  const prevWeekStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })
  const prevWeekEnd = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })

  let result = content

  result = result.replace(
    /{{本周日期范围}}/g,
    `${format(weekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(weekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  )
  
  result = result.replace(
    /{{上周日期范围}}/g,
    `${format(prevWeekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(prevWeekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  )
  
  result = result.replace(/{{当前周数}}/g, `第${getWeek(baseDate, { weekStartsOn: 1 })}周`)
  result = result.replace(/{{年份}}/g, String(getYear(baseDate)))
  result = result.replace(/{{月份}}/g, `${getMonth(baseDate) + 1}月`)

  return result
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (5 tests passing)

- [ ] **Step 9: Add test for section variables**

Add tests to `src/lib/template/render.test.ts`:

```typescript
it('should replace {{核心成果}} with 3 empty list items', () => {
  const content = '{{核心成果}}'
  const result = renderTemplate(content)
  
  expect(result).toBe('- \n- \n- ')
})

it('should replace {{问题与风险}} with 3 empty list items', () => {
  const content = '{{问题与风险}}'
  const result = renderTemplate(content)
  
  expect(result).toBe('- \n- \n- ')
})

it('should replace {{下周计划}} with 3 empty list items', () => {
  const content = '{{下周计划}}'
  const result = renderTemplate(content)
  
  expect(result).toBe('- \n- \n- ')
})

it('should replace {{日常事务}} with 3 empty list items', () => {
  const content = '{{日常事务}}'
  const result = renderTemplate(content)
  
  expect(result).toBe('- \n- \n- ')
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test src/lib/template/render.test.ts`

Expected: FAIL - section variables not replaced

- [ ] **Step 11: Implement section variable handling**

Update `src/lib/template/render.ts`:

```typescript
import { format, startOfWeek, endOfWeek, subWeeks, getWeek, getYear, getMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RenderOptions {
  date?: Date
}

export function renderTemplate(content: string, options: RenderOptions = {}): string {
  const baseDate = options.date || new Date()
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  const prevWeekStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })
  const prevWeekEnd = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })

  let result = content

  result = result.replace(
    /{{本周日期范围}}/g,
    `${format(weekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(weekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  )
  
  result = result.replace(
    /{{上周日期范围}}/g,
    `${format(prevWeekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(prevWeekEnd, 'yyyy.MM.dd', { locale: zhCN })}`
  )
  
  result = result.replace(/{{当前周数}}/g, `第${getWeek(baseDate, { weekStartsOn: 1 })}周`)
  result = result.replace(/{{年份}}/g, String(getYear(baseDate)))
  result = result.replace(/{{月份}}/g, `${getMonth(baseDate) + 1}月`)

  const sectionVariables = ['核心成果', '问题与风险', '下周计划', '日常事务']
  sectionVariables.forEach(sectionName => {
    const regex = new RegExp(`{{${sectionName}}}`, 'g')
    result = result.replace(regex, '- \n- \n- ')
  })

  return result
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (9 tests passing)

- [ ] **Step 13: Add test for content without variables**

Add test to `src/lib/template/render.test.ts`:

```typescript
it('should preserve content without variables', () => {
  const content = '## 本周完成\n- 工作项1\n- 工作项2'
  const result = renderTemplate(content)
  
  expect(result).toBe(content)
})
```

- [ ] **Step 14: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (10 tests passing) - regex replacement preserves non-matching content

- [ ] **Step 15: Add test for partial variables**

Add test to `src/lib/template/render.test.ts`:

```typescript
it('should handle partial variables in content', () => {
  const content = '## 本周完成\n{{本周日期范围}}\n## 下周计划\n- 继续开发'
  const result = renderTemplate(content, { date: new Date('2026-06-27') })
  
  expect(result).toContain('2026.06.22 - 2026.06.28')
  expect(result).toContain('- 继续开发')
})
```

- [ ] **Step 16: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (11 tests passing)

- [ ] **Step 17: Add test for misspelled variables**

Add test to `src/lib/template/render.test.ts`:

```typescript
it('should not replace misspelled variables', () => {
  const content = '{{本周日期}} {{核心成果}}'
  const result = renderTemplate(content)
  
  expect(result).toBe('{{本周日期}} {{核心成果}}')
})
```

- [ ] **Step 18: Run test to verify it passes**

Run: `npm run test src/lib/template/render.test.ts`

Expected: PASS (12 tests passing) - regex only matches exact variable names

- [ ] **Step 19: Commit render function**

```bash
git add src/lib/template/render.ts src/lib/template/render.test.ts
git commit -m "feat: implement template variable rendering with 9 variables"
```

---

## Task 3: Template Preview API Endpoint

**Files:**
- Create: `src/app/api/templates/[id]/render/route.ts`

### Step 1: Create render API directory

```bash
mkdir -p src/app/api/templates/[id]/render
```

- [ ] **Step 2: Create API route file**

Create `src/app/api/templates/[id]/render/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate } from '@/lib/template/render'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const baseDateStr = searchParams.get('date') || new Date().toISOString()
    const baseDate = new Date(baseDateStr)
    
    if (isNaN(baseDate.getTime())) {
      return NextResponse.json(
        { error: '日期参数无效', code: 'INVALID_DATE' },
        { status: 400 }
      )
    }
    
    const templateId = params.id
    let templateContent: string
    
    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (!template) {
        return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
      }
      templateContent = template.content
    } else {
      const db = getDb()
      const templateIdNum = parseInt(templateId.replace('user-', ''))
      if (isNaN(templateIdNum)) {
        return NextResponse.json({ error: '模板ID无效', code: 'INVALID_ID' }, { status: 400 })
      }
      
      const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
      if (!template[0]) {
        return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
      }
      templateContent = template[0].content
    }
    
    const renderedContent = renderTemplate(templateContent, { date: baseDate })
    
    return NextResponse.json({ 
      content: renderedContent,
      templateId,
      baseDate: baseDate.toISOString()
    })
  } catch (error) {
    console.error('Template render error:', error)
    return NextResponse.json(
      { error: '模板渲染失败', code: 'RENDER_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Test API endpoint with curl**

Start dev server: `npm run dev`

Then test:

```bash
curl "http://localhost:3000/api/templates/official-general/render?date=2026-06-27T00:00:00Z"
```

Expected output: JSON with `content` field containing rendered Markdown

- [ ] **Step 4: Test with invalid date**

```bash
curl "http://localhost:3000/api/templates/official-general/render?date=invalid"
```

Expected: HTTP 400 with error message "日期参数无效"

- [ ] **Step 5: Test with non-existent template**

```bash
curl "http://localhost:3000/api/templates/official-nonexistent/render?date=2026-06-27T00:00:00Z"
```

Expected: HTTP 404 with error message "模板不存在"

- [ ] **Step 6: Commit API endpoint**

```bash
git add src/app/api/templates/[id]/render/route.ts
git commit -m "feat: add template preview API endpoint with variable rendering"
```

---

## Task 4: Modify Reports API for Template Rendering

**Files:**
- Modify: `src/app/api/reports/route.ts`

### Step 1: Read current route file

Read `src/app/api/reports/route.ts` to understand current structure.

- [ ] **Step 2: Add templateId parameter handling**

Modify `src/app/api/reports/route.ts` POST function:

```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { reports, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { reportSchema } from '@/lib/validations'
import { renderTemplate } from '@/lib/template/render'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET() {
  try {
    const db = getDb()
    const allReports = await db.select().from(reports).orderBy(reports.createdAt)
    return NextResponse.json({ reports: allReports })
  } catch (error) {
    return NextResponse.json(
      { error: '获取周报列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const validated = reportSchema.parse(body)
    
    // NEW: Support templateId parameter
    const { templateId, baseDate } = body
    let finalContent = validated.content
    
    if (templateId) {
      let templateContent: string
      
      if (templateId.startsWith('official-')) {
        const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
        templateContent = template?.content || ''
      } else if (templateId.startsWith('user-')) {
        const templateIdNum = parseInt(templateId.replace('user-', ''))
        const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
        templateContent = template[0]?.content || ''
      }
      
      if (templateContent) {
        finalContent = renderTemplate(templateContent, {
          date: baseDate ? new Date(baseDate) : new Date()
        })
      }
    }
    
    const now = new Date()
    const result = await db.insert(reports).values({
      title: validated.title,
      content: finalContent,
      weekStart: validated.weekStart,
      weekEnd: validated.weekEnd,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({ report: result[0] }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    console.error('POST /api/reports error:', error)
    return NextResponse.json(
      { error: '创建周报失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Test modified API with templateId**

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2026年第27周工作周报",
    "content": "",
    "weekStart": "2026-06-22",
    "weekEnd": "2026-06-28",
    "templateId": "official-general",
    "baseDate": "2026-06-27T00:00:00Z"
  }'
```

Expected: HTTP 201 with created report containing rendered content

- [ ] **Step 4: Verify database contains rendered content**

```bash
sqlite3 .data/db.sqlite "SELECT content FROM reports ORDER BY id DESC LIMIT 1;"
```

Expected: Should show rendered Markdown (variables replaced)

- [ ] **Step 5: Commit modified API**

```bash
git add src/app/api/reports/route.ts
git commit -m "feat: add templateId support to reports POST API with variable rendering"
```

---

## Task 5: VariableToolbar Component (TDD)

**Files:**
- Create: `src/components/VariableToolbar.tsx`
- Create: `src/components/VariableToolbar.test.tsx`

### Step 1: Write failing test for toolbar button

Create `src/components/VariableToolbar.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VariableToolbar } from './VariableToolbar'

describe('VariableToolbar', () => {
  it('should render dropdown trigger button', () => {
    const mockInsert = vi.fn()
    render(<VariableToolbar onInsertVariable={mockInsert} />)
    
    expect(screen.getByText('插入变量')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: FAIL with error "Cannot find module './VariableToolbar'"

- [ ] **Step 3: Create VariableToolbar component**

Create `src/components/VariableToolbar.tsx`:

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { VariableIcon } from 'lucide-react'

interface VariableToolbarProps {
  onInsertVariable: (variable: string) => void
}

export function VariableToolbar({ onInsertVariable }: VariableToolbarProps) {
  return (
    <Button variant="outline" size="sm" className="gap-2">
      <VariableIcon className="h-4 w-4" />
      插入变量
    </Button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: PASS (1 test)

- [ ] **Step 5: Add test for dropdown menu**

Add to `src/components/VariableToolbar.test.tsx`:

```typescript
import { fireEvent } from '@testing-library/react'

it('should open dropdown menu when clicked', async () => {
  const mockInsert = vi.fn()
  render(<VariableToolbar onInsertVariable={mockInsert} />)
  
  const button = screen.getByRole('button')
  fireEvent.click(button)
  
  expect(screen.getByText('系统变量')).toBeInTheDocument()
  expect(screen.getByText('区块变量')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: FAIL - dropdown menu not found

- [ ] **Step 7: Add dropdown menu to component**

Update `src/components/VariableToolbar.tsx`:

```typescript
'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { VariableIcon } from 'lucide-react'

interface VariableToolbarProps {
  onInsertVariable: (variable: string) => void
}

const SYSTEM_VARIABLES = [
  { name: '{{本周日期范围}}', description: '自动计算本周起止日期' },
  { name: '{{上周日期范围}}', description: '自动计算上周起止日期' },
  { name: '{{当前周数}}', description: '自动计算当前周数' },
  { name: '{{年份}}', description: '当前年份' },
  { name: '{{月份}}', description: '当前月份' },
]

const SECTION_VARIABLES = [
  { name: '{{核心成果}}', description: '核心成果区块骨架' },
  { name: '{{问题与风险}}', description: '问题与风险区块骨架' },
  { name: '{{下周计划}}', description: '下周计划区块骨架' },
  { name: '{{日常事务}}', description: '日常事务区块骨架' },
]

export function VariableToolbar({ onInsertVariable }: VariableToolbarProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <VariableIcon className="h-4 w-4" />
          插入变量
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>系统变量</DropdownMenuLabel>
        {SYSTEM_VARIABLES.map((variable) => (
          <DropdownMenuItem
            key={variable.name}
            onClick={() => onInsertVariable(variable.name)}
            className="flex flex-col items-start gap-1"
          >
            <span className="font-mono text-sm">{variable.name}</span>
            <span className="text-xs text-muted-foreground">{variable.description}</span>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel>区块变量</DropdownMenuLabel>
        {SECTION_VARIABLES.map((variable) => (
          <DropdownMenuItem
            key={variable.name}
            onClick={() => onInsertVariable(variable.name)}
            className="flex flex-col items-start gap-1"
          >
            <span className="font-mono text-sm">{variable.name}</span>
            <span className="text-xs text-muted-foreground">{variable.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: PASS (2 tests)

- [ ] **Step 9: Add test for variable display**

Add to `src/components/VariableToolbar.test.tsx`:

```typescript
it('should display all system variables in dropdown', async () => {
  const mockInsert = vi.fn()
  render(<VariableToolbar onInsertVariable={mockInsert} />)
  
  fireEvent.click(screen.getByRole('button'))
  
  expect(screen.getByText('{{本周日期范围}}')).toBeInTheDocument()
  expect(screen.getByText('{{上周日期范围}}')).toBeInTheDocument()
  expect(screen.getByText('{{当前周数}}')).toBeInTheDocument()
  expect(screen.getByText('{{年份}}')).toBeInTheDocument()
  expect(screen.getByText('{{月份}}')).toBeInTheDocument()
})

it('should display all section variables in dropdown', async () => {
  const mockInsert = vi.fn()
  render(<VariableToolbar onInsertVariable={mockInsert} />)
  
  fireEvent.click(screen.getByRole('button'))
  
  expect(screen.getByText('{{核心成果}}')).toBeInTheDocument()
  expect(screen.getByText('{{问题与风险}}')).toBeInTheDocument()
  expect(screen.getByText('{{下周计划}}')).toBeInTheDocument()
  expect(screen.getByText('{{日常事务}}')).toBeInTheDocument()
})
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: PASS (4 tests)

- [ ] **Step 11: Add test for click handler**

Add to `src/components/VariableToolbar.test.tsx`:

```typescript
it('should call onInsertVariable when system variable is clicked', async () => {
  const mockInsert = vi.fn()
  render(<VariableToolbar onInsertVariable={mockInsert} />)
  
  fireEvent.click(screen.getByRole('button'))
  fireEvent.click(screen.getByText('{{本周日期范围}}'))
  
  expect(mockInsert).toHaveBeenCalledWith('{{本周日期范围}}')
})

it('should call onInsertVariable when section variable is clicked', async () => {
  const mockInsert = vi.fn()
  render(<VariableToolbar onInsertVariable={mockInsert} />)
  
  fireEvent.click(screen.getByRole('button'))
  fireEvent.click(screen.getByText('{{核心成果}}'))
  
  expect(mockInsert).toHaveBeenCalledWith('{{核心成果}}')
})
```

- [ ] **Step 12: Run test to verify it passes**

Run: `npm run test src/components/VariableToolbar.test.tsx`

Expected: PASS (6 tests)

- [ ] **Step 13: Commit VariableToolbar component**

```bash
git add src/components/VariableToolbar.tsx src/components/VariableToolbar.test.tsx
git commit -m "feat: implement VariableToolbar component with dropdown menu"
```

---

## Task 6: Integrate Toolbar into Pages

**Files:**
- Modify: `src/app/new/page.tsx`
- Modify: `src/app/edit/[id]/page.tsx`
- Create: `src/app/new/page.test.tsx`
- Create: `src/app/edit/[id]/page.test.tsx`

### Step 1: Read current new/page.tsx

Read `src/app/new/page.tsx` to understand current structure.

- [ ] **Step 2: Add VariableToolbar to new/page.tsx**

Modify `src/app/new/page.tsx` to import and render toolbar:

Find the section with MilkdownEditor (around line 184) and modify:

```typescript
// BEFORE (around line 184):
<div className="col-span-2 space-y-2">
  <Label>内容</Label>
  <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
</div>

// AFTER:
<div className="col-span-2 space-y-2">
  <div className="flex items-center justify-between">
    <Label>内容</Label>
    <VariableToolbar onInsertVariable={handleInsertVariable} />
  </div>
  <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
</div>
```

Add import at top:

```typescript
import { VariableToolbar } from '@/components/VariableToolbar'
```

Add handleInsertVariable function (before handleSubmit):

```typescript
function handleInsertVariable(variable: string) {
  setContent(prev => prev + '\n' + variable + '\n')
  setEditorKey(k => k + 1)
  toast.success(`已插入变量：${variable}`)
}
```

Update handleTemplateChange to use preview API:

```typescript
async function handleTemplateChange(templateId: string) {
  setSelectedTemplateId(templateId)
  
  try {
    const response = await fetch(
      `/api/templates/${templateId}/render?date=${baseDate.toISOString()}`
    )
    
    if (!response.ok) {
      const error = await response.json()
      toast.error(error.error || '模板加载失败')
      return
    }
    
    const data = await response.json()
    setContent(data.content)
    setEditorKey(k => k + 1)
  } catch (error) {
    toast.error('模板预览失败，请重试')
  }
}
```

- [ ] **Step 3: Write test for new page**

Create `src/app/new/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewReportPage from './page'
import { useRouter } from 'next/navigation'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('NewReportPage', () => {
  const mockPush = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        official: [
          { id: 'official-general', name: '通用模板', content: '## {{本周日期范围}}\n{{核心成果}}' }
        ],
        user: [],
      }),
    })
  })
  
  it('should render VariableToolbar component', async () => {
    render(<NewReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
  })
  
  it('should insert variable when toolbar is used', async () => {
    const user = userEvent.setup()
    render(<NewReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('插入变量'))
    await user.click(screen.getByText('{{本周日期范围}}'))
    
    expect(vi.mocked(require('sonner').toast.success)).toHaveBeenCalledWith('已插入变量：{{本周日期范围}}')
  })
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test src/app/new/page.test.tsx`

Expected: PASS (2 tests)

- [ ] **Step 5: Commit new/page.tsx changes**

```bash
git add src/app/new/page.tsx src/app/new/page.test.tsx
git commit -m "feat: integrate VariableToolbar into new report page"
```

- [ ] **Step 6: Read current edit/[id]/page.tsx**

Read `src/app/edit/[id]/page.tsx` to understand structure.

- [ ] **Step 7: Add VariableToolbar to edit/[id]/page.tsx**

Modify `src/app/edit/[id]/page.tsx` similarly to new/page.tsx:

Add import:
```typescript
import { VariableToolbar } from '@/components/VariableToolbar'
```

Find MilkdownEditor section and add toolbar:
```typescript
<div className="col-span-2 space-y-2">
  <div className="flex items-center justify-between">
    <Label>内容</Label>
    <VariableToolbar onInsertVariable={handleInsertVariable} />
  </div>
  <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
</div>
```

Add handleInsertVariable function:
```typescript
function handleInsertVariable(variable: string) {
  setContent(prev => prev + '\n' + variable + '\n')
  setEditorKey(k => k + 1)
  toast.success(`已插入变量：${variable}`)
}
```

- [ ] **Step 8: Write test for edit page**

Create `src/app/edit/[id]/page.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditReportPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: vi.fn().mockReturnValue({ id: '1' }),
}))

describe('EditReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        title: '2026年第27周工作周报',
        content: '## 本周完成\n- 工作项1',
        weekStart: '2026-06-22',
        weekEnd: '2026-06-28',
      }),
    })
  })
  
  it('should render VariableToolbar component', async () => {
    render(<EditReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
  })
  
  it('should allow inserting variables in existing report', async () => {
    const user = userEvent.setup()
    render(<EditReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('插入变量'))
    await user.click(screen.getByText('{{下周计划}}'))
    
    expect(vi.mocked(require('sonner').toast.success)).toHaveBeenCalled()
  })
})
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test src/app/edit/[id]/page.test.tsx`

Expected: PASS (2 tests)

- [ ] **Step 10: Commit edit page changes**

```bash
git add src/app/edit/[id]/page.tsx src/app/edit/[id]/page.test.tsx
git commit -m "feat: integrate VariableToolbar into edit report page"
```

---

## Task 7: End-to-End Testing and Verification

**Files:**
- No new files, all existing test files

### Step 1: Run all tests

Run: `npm run test`

Expected: All tests PASS (check total count)

- [ ] **Step 2: Run tests with coverage**

Run: `npm run test:coverage`

Expected: Coverage report showing coverage for:
- `src/lib/template/render.ts`
- `src/components/VariableToolbar.tsx`
- `src/app/new/page.tsx` (partial)
- `src/app/edit/[id]/page.tsx` (partial)

- [ ] **Step 3: Manual browser testing**

Start dev server: `npm run dev`

Open browser: `http://localhost:3000/new`

Manual verification checklist:
1. [ ] Page loads with VariableToolbar visible
2. [ ] Click "插入变量" button - dropdown opens
3. [ ] Dropdown shows 5 system variables + 4 section variables
4. [ ] Click a variable - toast message appears
5. [ ] Editor content shows inserted variable
6. [ ] Select different template - content updates with rendered variables
7. [ ] Change base date (click prev/next week) - re-select template to verify date variables update
8. [ ] Save report - verify it's created with rendered content

- [ ] **Step 4: Manual edit page testing**

Open existing report: `http://localhost:3000/edit/1`

Manual verification:
1. [ ] VariableToolbar visible
2. [ ] Insert variable works
3. [ ] Save changes works

- [ ] **Step 5: Check database content**

Query database to verify content is rendered:

```bash
sqlite3 .data/db.sqlite "SELECT title, content FROM reports ORDER BY id DESC LIMIT 2;"
```

Expected: Should see rendered content (variables replaced, no {{...}} syntax)

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "test: complete P1 template variable engine with full test coverage"
```

---

## Self-Review Checklist

After completing this plan, verify:

**1. Spec Coverage** ✅
- All 9 variables implemented (5 system + 4 section)
- Schema config field added
- Two API endpoints created (preview + modified create)
- VariableToolbar component created
- Both pages integrated (new + edit)
- Tests cover all components (render, toolbar, pages)

**2. Placeholder Scan** ✅
- No "TBD", "TODO", or vague descriptions
- All code steps show complete implementation
- All commands show exact syntax and expected output

**3. Type Consistency** ✅
- `renderTemplate(content: string, options: RenderOptions): string` - used consistently
- `VariableToolbarProps` interface - used in component and tests
- `TemplateConfig` interface - defined in schema.ts
- API response types - consistent across both endpoints

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-template-variable-engine.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**