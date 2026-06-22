# Weekly Reporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal weekly report editor with Markdown support, SQLite storage, and a modern UI.

**Architecture:** Next.js App Router with server components and server actions. Drizzle ORM manages SQLite database stored in XDG-compliant location. Milkdown provides WYSIWYG editing experience.

**Tech Stack:** Next.js 14+, Drizzle ORM, better-sqlite3, Milkdown, shadcn/ui, Tailwind CSS, Zod

---

## File Structure

### New Files to Create

```
src/
├── app/
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home - report list
│   ├── new/
│   │   └── page.tsx                  # New report page
│   ├── edit/
│   │   └── [id]/
│   │       └── page.tsx              # Edit report page
│   └── api/
│       └── reports/
│           ├── route.ts              # GET (list) / POST (create)
│           ├── [id]/
│           │   └── route.ts          # GET / PUT / DELETE single report
│           └── search/
│               └── route.ts          # Search reports
├── components/
│   ├── ui/                           # shadcn components (added via CLI)
│   ├── editor/
│   │   └── MilkdownEditor.tsx        # Milkdown wrapper
│   ├── ReportList.tsx                # Report list component
│   ├── ReportCard.tsx                # Report card component
│   ├── SearchBar.tsx                 # Search bar component
│   └── DatePicker.tsx                # Date picker component
├── lib/
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema
│   │   └── index.ts                  # Database connection
│   ├── paths.ts                      # XDG path resolution
│   ├── utils.ts                      # Utility functions
│   └── validations.ts                # Zod schemas
└── types/
    └── index.ts                      # Type definitions

drizzle.config.ts                     # Drizzle configuration
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.gitignore`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Import alias: `@/*`

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
npm install @milkdown/ctx @milkdown/core @milkdown/vue @milkdown/preset-commonmark @milkdown/preset-gfm @milkdown/theme-nord @milkdown/plugin-listener
npm install zod react-hook-form @hookform/resolvers date-fns
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-toast class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Create drizzle.config.ts**

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    filename: './data/reports.db',
  },
} satisfies Config
```

- [ ] **Step 4: Update .gitignore**

Add to `.gitignore`:
```
# Database
data/
*.db

# XDG data directories (for development)
.local/
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: initialize Next.js project with dependencies"
```

---

## Task 2: XDG Paths and Database Setup

**Files:**
- Create: `src/lib/paths.ts`
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`
- Test: `src/lib/__tests__/paths.test.ts`

- [ ] **Step 1: Write failing test for XDG paths**

Create `src/lib/__tests__/paths.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('XDG Paths', () => {
  const originalXdgDataHome = process.env.XDG_DATA_HOME
  const originalXdgConfigHome = process.env.XDG_CONFIG_HOME

  beforeEach(() => {
    delete process.env.XDG_DATA_HOME
    delete process.env.XDG_CONFIG_HOME
  })

  afterEach(() => {
    if (originalXdgDataHome) process.env.XDG_DATA_HOME = originalXdgDataHome
    if (originalXdgConfigHome) process.env.XDG_CONFIG_HOME = originalXdgConfigHome
  })

  it('should use default XDG_DATA_HOME when not set', async () => {
    const { DATA_DIR } = await import('../paths')
    const expected = path.join(os.homedir(), '.local', 'share', 'weekly-reporter')
    expect(DATA_DIR).toBe(expected)
  })

  it('should use XDG_DATA_HOME from environment when set', async () => {
    process.env.XDG_DATA_HOME = '/custom/data'
    // Clear module cache
    const modulePath = require.resolve('../paths')
    delete require.cache[modulePath]
    
    const { DATA_DIR } = await import('../paths')
    expect(DATA_DIR).toBe('/custom/data/weekly-reporter')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/lib/__tests__/paths.test.ts
```
Expected: FAIL with "Cannot find module '../paths'"

- [ ] **Step 3: Create XDG paths module**

Create `src/lib/paths.ts`:
```typescript
import path from 'path'
import os from 'os'
import { mkdirSync, existsSync } from 'fs'

const XDG_DATA_HOME = process.env.XDG_DATA_HOME || 
  path.join(os.homedir(), '.local', 'share')
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || 
  path.join(os.homedir(), '.config')

export const DATA_DIR = path.join(XDG_DATA_HOME, 'weekly-reporter')
export const CONFIG_DIR = path.join(XDG_CONFIG_HOME, 'weekly-reporter')
export const DB_PATH = path.join(DATA_DIR, 'reports.db')

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- src/lib/__tests__/paths.test.ts
```
Expected: PASS

- [ ] **Step 5: Write failing test for database schema**

Create `src/lib/db/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { reports } from '../schema'

describe('Database Schema', () => {
  it('should have reports table with correct columns', () => {
    expect(reports).toBeDefined()
    expect(reports.id).toBeDefined()
    expect(reports.title).toBeDefined()
    expect(reports.content).toBeDefined()
    expect(reports.weekStart).toBeDefined()
    expect(reports.weekEnd).toBeDefined()
    expect(reports.createdAt).toBeDefined()
    expect(reports.updatedAt).toBeDefined()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run:
```bash
npm test -- src/lib/db/__tests__/schema.test.ts
```
Expected: FAIL with "Cannot find module '../schema'"

- [ ] **Step 7: Create database schema**

Create `src/lib/db/schema.ts`:
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
```

- [ ] **Step 8: Run test to verify it passes**

Run:
```bash
npm test -- src/lib/db/__tests__/schema.test.ts
```
Expected: PASS

- [ ] **Step 9: Create database connection module**

Create `src/lib/db/index.ts`:
```typescript
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DB_PATH, ensureDataDir } from '../paths'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!db) {
    ensureDataDir()
    const sqlite = new Database(DB_PATH)
    db = drizzle(sqlite, { schema })
    
    // Run migrations
    migrate(db, { migrationsFolder: './drizzle' })
  }
  return db
}

export { schema }
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/paths.ts src/lib/db/schema.ts src/lib/db/index.ts src/lib/__tests__ src/lib/db/__tests__
git commit -m "feat: add XDG paths and database setup"
```

---

## Task 3: Zod Validations

**Files:**
- Create: `src/lib/validations.ts`
- Test: `src/lib/__tests__/validations.test.ts`

- [ ] **Step 1: Write failing tests for validations**

Create `src/lib/__tests__/validations.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { reportSchema } from '../validations'

describe('Report Validations', () => {
  it('should validate a valid report', () => {
    const result = reportSchema.safeParse({
      title: '2024年第1周工作周报',
      content: '# 本周工作\n完成了项目开发',
      weekStart: '2024-01-01',
      weekEnd: '2024-01-07',
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty title', () => {
    const result = reportSchema.safeParse({
      title: '',
      content: 'content',
      weekStart: '2024-01-01',
      weekEnd: '2024-01-07',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid date format', () => {
    const result = reportSchema.safeParse({
      title: 'title',
      content: 'content',
      weekStart: '01-01-2024',
      weekEnd: '2024-01-07',
    })
    expect(result.success).toBe(false)
  })

  it('should reject weekEnd before weekStart', () => {
    const result = reportSchema.safeParse({
      title: 'title',
      content: 'content',
      weekStart: '2024-01-07',
      weekEnd: '2024-01-01',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/lib/__tests__/validations.test.ts
```
Expected: FAIL with "Cannot find module '../validations'"

- [ ] **Step 3: Create validation schemas**

Create `src/lib/validations.ts`:
```typescript
import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const reportSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空'),
  weekStart: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
  weekEnd: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
}).refine(
  (data) => new Date(data.weekStart) <= new Date(data.weekEnd),
  {
    message: '开始日期不能晚于结束日期',
    path: ['weekEnd'],
  }
)

export type ReportInput = z.infer<typeof reportSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- src/lib/__tests__/validations.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/lib/__tests__/validations.test.ts
git commit -m "feat: add report validation schemas"
```

---

## Task 4: Database Migration

**Files:**
- Generate: `drizzle/` directory

- [ ] **Step 1: Generate initial migration**

Run:
```bash
npx drizzle-kit generate:sqlite
```

- [ ] **Step 2: Verify migration files**

Check that `drizzle/` directory contains SQL migration files.

- [ ] **Step 3: Commit**

```bash
git add drizzle/
git commit -m "chore: add database migration"
```

---

## Task 5: Utility Functions

**Files:**
- Create: `src/lib/utils.ts`
- Test: `src/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write failing tests for utilities**

Create `src/lib/__tests__/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { cn, formatDate, getWeekRange } from '../utils'

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })
  })

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2024-01-15')
      expect(formatDate(date)).toBe('2024-01-15')
    })
  })

  describe('getWeekRange', () => {
    it('should return week start and end dates', () => {
      const date = new Date('2024-01-15') // Monday
      const { start, end } = getWeekRange(date)
      expect(formatDate(start)).toBe('2024-01-15')
      expect(formatDate(end)).toBe('2024-01-21')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- src/lib/__tests__/utils.test.ts
```
Expected: FAIL with "Cannot find module '../utils'"

- [ ] **Step 3: Create utility functions**

Create `src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfWeek, endOfWeek } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- src/lib/__tests__/utils.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts
git commit -m "feat: add utility functions"
```

---

## Task 6: shadcn/ui Setup

**Files:**
- Create: `src/components/ui/` (multiple files via CLI)
- Create: `src/lib/utils.ts` (modify to add cn function)

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
npx shadcn-ui@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 2: Add required components**

Run:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add textarea
```

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: setup shadcn/ui and add components"
```

---

## Task 7: API Routes - Reports CRUD

**Files:**
- Create: `src/app/api/reports/route.ts`
- Create: `src/app/api/reports/[id]/route.ts`
- Create: `src/app/api/reports/search/route.ts`
- Test: `src/app/api/__tests__/reports.test.ts`

- [ ] **Step 1: Write failing tests for API routes**

Create `src/app/api/__tests__/reports.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../reports/route'
import { GET as GET_ONE, PUT, DELETE } from '../reports/[id]/route'
import { GET as SEARCH } from '../search/route'

// Mock database
jest.mock('../../../lib/db', () => ({
  getDb: () => ({
    query: {
      reports: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(() => [{ id: 1 }]),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(() => [{ id: 1 }]),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => [{ id: 1 }]),
      })),
    })),
  }),
}))

describe('Reports API', () => {
  describe('GET /api/reports', () => {
    it('should return list of reports', async () => {
      const response = await GET(new NextRequest('http://localhost/api/reports'))
      expect(response.status).toBe(200)
    })
  })

  describe('POST /api/reports', () => {
    it('should create a new report', async () => {
      const body = JSON.stringify({
        title: 'Test Report',
        content: '# Content',
        weekStart: '2024-01-01',
        weekEnd: '2024-01-07',
      })
      const request = new NextRequest('http://localhost/api/reports', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request)
      expect(response.status).toBe(201)
    })
  })
})
```

Note: The above test uses Jest mocks. We'll need to configure Vitest properly.

- [ ] **Step 2: Create GET /api/reports**

Create `src/app/api/reports/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    const offset = (page - 1) * pageSize
    
    const allReports = await db.query.reports.findMany({
      orderBy: [desc(reports.createdAt)],
      limit: pageSize,
      offset,
    })
    
    const total = await db.select().from(reports).all().length
    
    return NextResponse.json({
      reports: allReports,
      total,
      page,
      pageSize,
    })
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
    
    const { reportSchema } = await import('@/lib/validations')
    const validated = reportSchema.parse(body)
    
    const now = new Date()
    const result = await db.insert(reports).values({
      ...validated,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '创建周报失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Create GET/PUT/DELETE /api/reports/[id]**

Create `src/app/api/reports/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'
import { reportSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const report = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    })
    
    if (!report) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(report)
  } catch (error) {
    return NextResponse.json(
      { error: '获取周报失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const validated = reportSchema.parse(body)
    
    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    const result = await db.update(reports)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning()
    
    return NextResponse.json(result[0])
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '更新周报失败', code: 'UPDATE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const id = parseInt(params.id)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的周报ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    const existing = await db.query.reports.findFirst({
      where: eq(reports.id, id),
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: '周报不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    await db.delete(reports).where(eq(reports.id, id))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '删除周报失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Create GET /api/reports/search**

Create `src/app/api/reports/search/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { or, like, and, gte, lte } from 'drizzle-orm'
import { reports } from '@/lib/db/schema'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const conditions = []
    
    if (query) {
      conditions.push(
        or(
          like(reports.title, `%${query}%`),
          like(reports.content, `%${query}%`)
        )
      )
    }
    
    if (startDate) {
      conditions.push(gte(reports.weekStart, startDate))
    }
    
    if (endDate) {
      conditions.push(lte(reports.weekEnd, endDate))
    }
    
    const results = await db.query.reports.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (reports, { desc }) => [desc(reports.createdAt)],
    })
    
    return NextResponse.json({ reports: results })
  } catch (error) {
    return NextResponse.json(
      { error: '搜索失败', code: 'SEARCH_ERROR' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add reports API routes"
```

---

## Task 8: Root Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Update globals.css**

Modify `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Update root layout**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '周报编辑器',
  description: '个人周报管理工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: add root layout and global styles"
```

---

## Task 9: Report Card Component

**Files:**
- Create: `src/components/ReportCard.tsx`

- [ ] **Step 1: Create ReportCard component**

Create `src/components/ReportCard.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { Report } from '@/lib/db/schema'

interface ReportCardProps {
  report: Report
  onDelete: (id: number) => void
}

export function ReportCard({ report, onDelete }: ReportCardProps) {
  const weekStart = format(new Date(report.weekStart), 'MM/dd', { locale: zhCN })
  const weekEnd = format(new Date(report.weekEnd), 'MM/dd', { locale: zhCN })
  const createdAt = format(new Date(report.createdAt), 'yyyy-MM-dd', { locale: zhCN })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{report.title}</CardTitle>
          <div className="flex gap-2">
            <Link href={`/edit/${report.id}`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(report.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {weekStart} - {weekEnd}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          创建于 {createdAt}
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ReportCard.tsx
git commit -m "feat: add ReportCard component"
```

---

## Task 10: Search Bar Component

**Files:**
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Create SearchBar component**

Create `src/components/SearchBar.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder = '搜索周报...' }: SearchBarProps) {
  const [value, setValue] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    onSearch(newValue)
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className="pl-10"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SearchBar.tsx
git commit -m "feat: add SearchBar component"
```

---

## Task 11: Home Page - Report List

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/ReportList.tsx`

- [ ] **Step 1: Create ReportList component**

Create `src/components/ReportList.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { ReportCard } from './ReportCard'
import { SearchBar } from './SearchBar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import type { Report } from '@/lib/db/schema'

export function ReportList() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    try {
      const response = await fetch('/api/reports')
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch(query: string) {
    if (!query.trim()) {
      fetchReports()
      return
    }

    try {
      const response = await fetch(`/api/reports/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error('Failed to search reports:', error)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定要删除这篇周报吗？')) return

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setReports(reports.filter((r) => r.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete report:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">周报编辑器</h1>
        <Link href="/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建周报
          </Button>
        </Link>
      </div>

      <SearchBar onSearch={handleSearch} />

      {reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          暂无周报，点击"新建周报"开始创建
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update home page**

Modify `src/app/page.tsx`:
```typescript
import { ReportList } from '@/components/ReportList'

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <ReportList />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ReportList.tsx src/app/page.tsx
git commit -m "feat: add home page with report list"
```

---

## Task 12: Date Picker Component

**Files:**
- Create: `src/components/DatePicker.tsx`

- [ ] **Step 1: Create DatePicker component**

Create `src/components/DatePicker.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'yyyy-MM-dd') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date)
            setOpen(false)
          }}
          locale={zhCN}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
```

Note: This requires the Calendar component from shadcn/ui. Add it:

Run:
```bash
npx shadcn-ui@latest add calendar
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DatePicker.tsx src/components/ui/calendar.tsx
git commit -m "feat: add DatePicker component"
```

---

## Task 13: Milkdown Editor Component

**Files:**
- Create: `src/components/editor/MilkdownEditor.tsx`

- [ ] **Step 1: Create MilkdownEditor component**

Create `src/components/editor/MilkdownEditor.tsx`:
```typescript
'use client'

import { useEffect, useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function MilkdownEditor({
  value,
  onChange,
  placeholder = '开始编写周报...',
}: MilkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorInstance = useRef<Editor | null>(null)

  useEffect(() => {
    if (!editorRef.current || editorInstance.current) return

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorRef.current!)
        ctx.set(defaultValueCtx, value || placeholder)
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown) => {
          onChange(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .create()
      .then((editor) => {
        editorInstance.current = editor
      })

    return () => {
      editorInstance.current?.destroy()
      editorInstance.current = null
    }
  }, [])

  return (
    <div
      ref={editorRef}
      className="prose prose-sm max-w-none min-h-[400px] border rounded-md p-4 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
    />
  )
}
```

Note: This is a basic implementation. You may need to adjust based on Milkdown's actual API.

- [ ] **Step 2: Commit**

```bash
git add src/components/editor/MilkdownEditor.tsx
git commit -m "feat: add MilkdownEditor component"
```

---

## Task 14: New Report Page

**Files:**
- Create: `src/app/new/page.tsx`

- [ ] **Step 1: Create new report page**

Create `src/app/new/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/DatePicker'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { getWeekRange, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

export default function NewReportPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const { start } = getWeekRange(new Date())
    return start
  })
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const { end } = getWeekRange(new Date())
    return end
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !content.trim() || !startDate || !endDate) {
      alert('请填写所有必填项')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          weekStart: formatDate(startDate),
          weekEnd: formatDate(endDate),
        }),
      })

      if (response.ok) {
        router.push('/')
      } else {
        const error = await response.json()
        alert(error.error || '保存失败')
      }
    } catch (error) {
      console.error('Failed to save report:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建周报</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：2024年第1周工作周报"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="选择开始日期"
            />
          </div>
          <div className="space-y-2">
            <Label>结束日期</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="选择结束日期"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>内容</Label>
          <MilkdownEditor value={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/new/page.tsx
git commit -m "feat: add new report page"
```

---

## Task 15: Edit Report Page

**Files:**
- Create: `src/app/edit/[id]/page.tsx`

- [ ] **Step 1: Create edit report page**

Create `src/app/edit/[id]/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/DatePicker'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import type { Report } from '@/lib/db/schema'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/${id}`)
        if (response.ok) {
          const report: Report = await response.json()
          setTitle(report.title)
          setContent(report.content)
          setStartDate(new Date(report.weekStart))
          setEndDate(new Date(report.weekEnd))
        } else {
          alert('周报不存在')
          router.push('/')
        }
      } catch (error) {
        console.error('Failed to fetch report:', error)
        alert('加载失败')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!title.trim() || !content.trim() || !startDate || !endDate) {
      alert('请填写所有必填项')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          weekStart: formatDate(startDate),
          weekEnd: formatDate(endDate),
        }),
      })

      if (response.ok) {
        router.push('/')
      } else {
        const error = await response.json()
        alert(error.error || '保存失败')
      }
    } catch (error) {
      console.error('Failed to save report:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="text-center">加载中...</div>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">编辑周报</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：2024年第1周工作周报"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              placeholder="选择开始日期"
            />
          </div>
          <div className="space-y-2">
            <Label>结束日期</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="选择结束日期"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>内容</Label>
          <MilkdownEditor value={content} onChange={setContent} />
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/edit/
git commit -m "feat: add edit report page"
```

---

## Task 16: Add Toast Notifications

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/ui/toaster.tsx`
- Create: `src/hooks/use-toast.ts`

- [ ] **Step 1: Add toast component**

Run:
```bash
npx shadcn-ui@latest add toast
```

- [ ] **Step 2: Update layout to include Toaster**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '周报编辑器',
  description: '个人周报管理工具',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Update ReportList to use toast**

Modify `src/components/ReportList.tsx` to use toast notifications instead of console.error.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/ReportList.tsx src/components/ui/toast.tsx src/components/ui/toaster.tsx src/hooks/use-toast.ts
git commit -m "feat: add toast notifications"
```

---

## Task 17: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Create test setup file**

Create `src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Update package.json scripts**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/test/setup.ts package.json
git commit -m "chore: configure Vitest for testing"
```

---

## Task 18: Final Testing and Polish

**Files:**
- Various test files

- [ ] **Step 1: Run all tests**

Run:
```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Run development server**

Run:
```bash
npm run dev
```

- [ ] **Step 3: Manual testing**

Test the following flows:
1. Create a new report
2. View report list
3. Edit a report
4. Delete a report
5. Search reports

- [ ] **Step 4: Fix any issues found during testing**

- [ ] **Step 5: Build for production**

Run:
```bash
npm run build
```

Expected: Build succeeds without errors

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final testing and polish"
```

---

## Summary

This implementation plan creates a fully functional weekly report editor with:
- Next.js 14+ App Router
- Drizzle ORM with SQLite (XDG-compliant storage)
- Milkdown WYSIWYG editor
- shadcn/ui components
- Complete CRUD operations
- Search functionality
- Toast notifications
- Comprehensive testing

Estimated implementation time: 2-3 hours for an experienced developer following this plan.