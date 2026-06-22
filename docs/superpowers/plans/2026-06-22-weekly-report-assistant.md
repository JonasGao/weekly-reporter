# 周报写作助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为周报编辑器添加模板系统和 AI 智能建议功能，帮助用户写出更好的周报。

**Architecture:** 模板系统使用数据库存储，前端渲染模板引导。智能建议调用云端 AI API 分析内容，实时提示和评分通过独立 API 和 UI 组件实现。

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, Milkdown, AI API (OpenAI/Claude)

---

## File Structure

### 新建文件
- `src/lib/db/schema.ts` — 添加 templates 表定义
- `src/lib/db/migrations/0002_add_templates.sql` — 数据库迁移文件
- `src/lib/ai.ts` — AI API 客户端封装
- `src/lib/template-default.ts` — 默认模板内容
- `src/app/api/templates/route.ts` — 模板 CRUD API
- `src/app/api/templates/[id]/route.ts` — 单个模板操作 API
- `src/app/api/reports/check/route.ts` — AI 智能检查 API
- `src/app/templates/page.tsx` — 模板管理页面
- `src/components/TemplateList.tsx` — 模板列表组件
- `src/components/TemplateForm.tsx` — 模板编辑表单
- `src/components/CheckPanel.tsx` — 智能检查面板
- `src/components/ScorePanel.tsx` — 评分展示面板
- `docs/superpowers/specs/2026-06-22-weekly-report-assistant-design.md` — 设计文档（已完成）

### 修改文件
- `src/app/new/page.tsx` — 集成模板选择和智能检查
- `src/app/edit/[id]/page.tsx` — 集成智能检查
- `src/lib/db/index.ts` — 初始化默认模板
- `.env.example` — 添加 AI API Key 配置
- `.env.development` — 添加 AI API Key（用户配置）

---

### Task 1: 添加 templates 数据库表

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0002_add_templates.sql`

- [ ] **Step 1: 添加 templates 表定义到 schema**

```typescript
// 在 src/lib/db/schema.ts 中添加

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  workTypes: text('work_types'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
```

- [ ] **Step 2: 创建迁移文件**

```sql
-- src/lib/db/migrations/0002_add_templates.sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  work_types TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

- [ ] **Step 3: 运行迁移**

```bash
source ~/.nvm/nvm.sh && npm run db:migrate
```

Expected: 数据库成功创建 templates 表

- [ ] **Step 4: 验证表结构**

```bash
sqlite3 ~/.local/share/weekly-reporter/reports.db ".schema templates"
```

Expected: 显示 templates 表结构

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0002_add_templates.sql
git commit -m "feat: add templates table for report templates"
```

---

### Task 2: 初始化默认模板

**Files:**
- Create: `src/lib/template-default.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 创建默认模板内容文件**

```typescript
// src/lib/template-default.ts

export const DEFAULT_TEMPLATE_CONTENT = `## 本周完成
- [工作项1：描述 + 成果/价值]
- [工作项2：描述 + 成果/价值]

## 进行中
- [项目/任务名称：进度描述 + 预计完成时间]

## 遇到的问题
- [问题描述 + 原因分析 + 已采取措施/需要支持]

## 下周计划
- [计划事项 + 优先级]
`

export const DEFAULT_TEMPLATE_NAME = '默认周报模板'
```

- [ ] **Step 2: 修改 db/index.ts 添加初始化逻辑**

```typescript
// src/lib/db/index.ts 添加初始化函数

import { templates } from './schema'
import { DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_CONTENT } from '../template-default'
import { eq } from 'drizzle-orm'

export async function initializeDefaultTemplate() {
  const existing = await db.select().from(templates).where(eq(templates.isDefault, true))
  
  if (existing.length === 0) {
    await db.insert(templates).values({
      name: DEFAULT_TEMPLATE_NAME,
      content: DEFAULT_TEMPLATE_CONTENT,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}
```

- [ ] **Step 3: 在应用启动时调用初始化**

修改 `src/lib/db/index.ts`，在导出 db 后添加：

```typescript
// 在文件末尾添加
initializeDefaultTemplate().catch(console.error)
```

- [ ] **Step 4: 测试初始化**

重启开发服务器，检查数据库是否有默认模板：

```bash
sqlite3 ~/.local/share/weekly-reporter/reports.db "SELECT * FROM templates"
```

Expected: 显示一条默认模板记录

- [ ] **Step 5: Commit**

```bash
git add src/lib/template-default.ts src/lib/db/index.ts
git commit -m "feat: initialize default report template on startup"
```

---

### Task 3: 创建模板 CRUD API

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/templates/[id]/route.ts`
- Create: `src/lib/validations.ts` (添加模板验证)

- [ ] **Step 1: 添加模板验证 schema**

在 `src/lib/validations.ts` 添加：

```typescript
import { z } from 'zod'

export const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  content: z.string().min(1, '模板内容不能为空'),
  workTypes: z.string().optional(),
})

export type TemplateInput = z.infer<typeof templateSchema>
```

- [ ] **Step 2: 创建模板列表 API**

```typescript
// src/app/api/templates/route.ts

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { templateSchema } from '@/lib/validations'

export async function GET() {
  const allTemplates = await db.select().from(templates)
  return NextResponse.json({ templates: allTemplates })
}

export async function POST(request: Request) {
  const body = await request.json()
  const validated = templateSchema.safeParse(body)
  
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
  }
  
  const newTemplate = await db.insert(templates).values({
    ...validated.data,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning()
  
  return NextResponse.json({ template: newTemplate[0] })
}
```

- [ ] **Step 3: 创建单个模板操作 API**

```typescript
// src/app/api/templates/[id]/route.ts

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { templateSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
  
  if (template.length === 0) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }
  
  return NextResponse.json({ template: template[0] })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const validated = templateSchema.safeParse(body)
  
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.errors[0].message }, { status: 400 })
  }
  
  const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
  
  if (template.length === 0) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }
  
  if (template[0].isDefault) {
    return NextResponse.json({ error: '默认模板不可修改' }, { status: 400 })
  }
  
  const updated = await db.update(templates)
    .set({
      ...validated.data,
      updatedAt: new Date(),
    })
    .where(eq(templates.id, parseInt(id)))
    .returning()
  
  return NextResponse.json({ template: updated[0] })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const template = await db.select().from(templates).where(eq(templates.id, parseInt(id)))
  
  if (template.length === 0) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }
  
  if (template[0].isDefault) {
    return NextResponse.json({ error: '默认模板不可删除' }, { status: 400 })
  }
  
  await db.delete(templates).where(eq(templates.id, parseInt(id)))
  
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: 测试 API**

```bash
curl http://localhost:6868/api/templates
```

Expected: 返回包含默认模板的列表

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations.ts src/app/api/templates/route.ts src/app/api/templates/[id]/route.ts
git commit -m "feat: add templates CRUD API"
```

---

### Task 4: 创建模板管理页面

**Files:**
- Create: `src/app/templates/page.tsx`
- Create: `src/components/TemplateList.tsx`
- Create: `src/components/TemplateForm.tsx`

- [ ] **Step 1: 创建模板列表组件**

```typescript
// src/components/TemplateList.tsx

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react'
import type { Template } from '@/lib/db/schema'

interface TemplateListProps {
  onSelect?: (template: Template) => void
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number, isDefault: boolean) {
    if (isDefault) {
      toast.error('默认模板不可删除')
      return
    }

    if (!confirm('确定要删除这个模板吗？')) return

    try {
      const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== id))
        toast.success('模板已删除')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="border rounded-lg p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">
              {template.name}
              {template.isDefault && (
                <span className="text-xs text-muted-foreground ml-2">(默认)</span>
              )}
            </div>
            {template.workTypes && (
              <div className="text-sm text-muted-foreground">
                适用：{template.workTypes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSelect && (
              <Button variant="outline" size="sm" onClick={() => onSelect(template)}>
                使用
              </Button>
            )}
            {!template.isDefault && (
              <>
                <Link href={`/templates/${template.id}`}>
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(template.id, template.isDefault)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 创建模板编辑表单组件**

```typescript
// src/components/TemplateForm.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

interface TemplateFormProps {
  template?: Template
  onSave: (data: { name: string; content: string; workTypes?: string }) => Promise<void>
  onCancel: () => void
}

export function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '')
  const [content, setContent] = useState(template?.content || '')
  const [workTypes, setWorkTypes] = useState(template?.workTypes || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !content.trim()) {
      toast.error('请填写模板名称和内容')
      return
    }

    setSaving(true)

    try {
      await onSave({ name, content, workTypes: workTypes.trim() || undefined })
      toast.success('模板已保存')
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">模板名称</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：开发周报模板"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="workTypes">适用工作类型</Label>
        <Input
          id="workTypes"
          value={workTypes}
          onChange={(e) => setWorkTypes(e.target.value)}
          placeholder="例如：开发,技术,产品"
        />
      </div>

      <div className="space-y-2">
        <Label>模板内容</Label>
        <MilkdownEditor value={content} onChange={setContent} />
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: 创建模板管理页面**

```typescript
// src/app/templates/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateList } from '@/components/TemplateList'
import { ArrowLeft, Plus } from 'lucide-react'

export default function TemplatesPage() {
  const router = useRouter()

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">模板管理</h1>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
        </Link>
      </div>

      <TemplateList />
    </main>
  )
}
```

- [ ] **Step 4: 创建新建模板页面**

```typescript
// src/app/templates/new/page.tsx

'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { ArrowLeft } from 'lucide-react'

export default function NewTemplatePage() {
  const router = useRouter()

  async function handleSave(data: { name: string; content: string; workTypes?: string }) {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('保存失败')
    }

    router.push('/templates')
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建模板</h1>
      </div>

      <TemplateForm
        onSave={handleSave}
        onCancel={() => router.push('/templates')}
      />
    </main>
  )
}
```

- [ ] **Step 5: 创建编辑模板页面**

```typescript
// src/app/templates/[id]/page.tsx

'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const response = await fetch(`/api/templates/${id}`)
        if (response.ok) {
          const data = await response.json()
          setTemplate(data.template)
        } else {
          toast.error('模板不存在')
          router.push('/templates')
        }
      } catch (error) {
        toast.error('加载失败')
        router.push('/templates')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplate()
  }, [id, router])

  async function handleSave(data: { name: string; content: string; workTypes?: string }) {
    const response = await fetch(`/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '保存失败')
    }

    router.push('/templates')
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="text-center">加载中...</div>
      </main>
    )
  }

  if (!template) {
    return null
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">编辑模板</h1>
      </div>

      <TemplateForm
        template={template}
        onSave={handleSave}
        onCancel={() => router.push('/templates')}
      />
    </main>
  )
}
```

- [ ] **Step 6: 测试模板管理页面**

访问 http://localhost:6868/templates，验证：
- 显示默认模板
- 可以新建模板
- 可以编辑自定义模板
- 可以删除自定义模板
- 默认模板不可删除

- [ ] **Step 7: Commit**

```bash
git add src/app/templates/page.tsx src/app/templates/new/page.tsx src/app/templates/[id]/page.tsx src/components/TemplateList.tsx src/components/TemplateForm.tsx
git commit -m "feat: add template management UI"
```

---

### Task 5: 创建 AI API 封装

**Files:**
- Create: `src/lib/ai.ts`
- Modify: `.env.example`
- Modify: `.env.development`

- [ ] **Step 1: 创建 AI API 客户端**

```typescript
// src/lib/ai.ts

const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

export interface CheckRequest {
  content: string
  section?: string
}

export interface CheckResponse {
  suggestions: string[]
  score?: number
}

export interface ScoreRequest {
  content: string
}

export interface ScoreResponse {
  score: {
    structure: number
    content: number
    value: number
    overall: number
  }
  suggestions: string[]
  rewriteExamples?: {
    original: string
    improved: string
  }[]
}

export async function checkContent(request: CheckRequest): Promise<CheckResponse> {
  const prompt = `你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
${request.content}

${request.section ? `当前区块：${request.section}` : ''}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字），以JSON数组格式返回。
如果内容很好，返回空数组 []。

示例输出格式：
["建议添加具体数据", "建议使用成果动词"]

直接返回JSON数组，不要其他内容。`

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error('AI API request failed')
  }

  const data = await response.json()
  const suggestionsText = data.choices[0].message.content.trim()
  
  try {
    const suggestions = JSON.parse(suggestionsText)
    return { suggestions }
  } catch {
    return { suggestions: [] }
  }
}

export async function scoreReport(request: ScoreRequest): Promise<ScoreResponse> {
  const prompt = `你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
${request.content}

请从以下维度评分（0-100）：
1. structure（结构完整度）：各区块是否填写完整
2. content（内容充实度）：是否有具体细节和数据
3. value（价值突出度）：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议（每条不超过30字）
3. （可选）改写示例

以以下JSON格式返回：
{
  "score": {
    "structure": <数字>,
    "content": <数字>,
    "value": <数字>,
    "overall": <数字>
  },
  "suggestions": ["<建议1>", "<建议2>"],
  "rewriteExamples": [
    {
      "original": "<原文>",
      "improved": "<改写>"
    }
  ]
}

直接返回JSON，不要其他内容。`

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error('AI API request failed')
  }

  const data = await response.json()
  const resultText = data.choices[0].message.content.trim()
  
  try {
    const result = JSON.parse(resultText)
    return {
      score: result.score,
      suggestions: result.suggestions || [],
      rewriteExamples: result.rewriteExamples,
    }
  } catch {
    return {
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['评分解析失败'],
    }
  }
}
```

- [ ] **Step 2: 更新 .env.example**

添加：
```
# AI API Configuration
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your-api-key-here
AI_MODEL=gpt-4o-mini
```

- [ ] **Step 3: 更新 .env.development**

添加（用户需要填写实际的 API Key）：
```
# AI API Configuration
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=
AI_MODEL=gpt-4o-mini
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai.ts .env.example .env.development
git commit -m "feat: add AI API client for report checking"
```

---

### Task 6: 创建智能检查 API

**Files:**
- Create: `src/app/api/reports/check/route.ts`

- [ ] **Step 1: 创建检查 API**

```typescript
// src/app/api/reports/check/route.ts

import { NextResponse } from 'next/server'
import { checkContent, scoreReport } from '@/lib/ai'

export async function POST(request: Request) {
  const body = await request.json()

  // 如果有 section 字段，说明是区块实时检查
  if (body.section) {
    try {
      const result = await checkContent(body)
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json({ suggestions: [] })
    }
  }

  // 否则是全文评分
  try {
    const result = await scoreReport(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['AI 服务暂时不可用'],
    })
  }
}
```

- [ ] **Step 2: 测试 API**

```bash
curl -X POST http://localhost:6868/api/reports/check \
  -H "Content-Type: application/json" \
  -d '{"content": "## 本周完成\n- 完成了功能开发", "section": "本周完成"}'
```

Expected: 返回建议数组

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports/check/route.ts
git commit -m "feat: add report check API endpoint"
```

---

### Task 7: 创建智能检查 UI 组件

**Files:**
- Create: `src/components/CheckPanel.tsx`
- Create: `src/components/ScorePanel.tsx`

- [ ] **Step 1: 创建区块解析函数**

在 `src/lib/utils.ts` 添加：

```typescript
export function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = content.split('\n')
  let currentSection = ''

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim()
      sections[currentSection] = ''
    } else if (currentSection) {
      sections[currentSection] += line + '\n'
    }
  }

  return sections
}

export function getSectionStatus(content: string): Record<string, 'empty' | 'short' | 'good'> {
  const sections = parseSections(content)
  const status: Record<string, 'empty' | 'short' | 'good'> = {}

  for (const [name, content] of Object.entries(sections)) {
    const trimmed = content.trim()
    if (trimmed.length === 0) {
      status[name] = 'empty'
    } else if (trimmed.length < 20) {
      status[name] = 'short'
    } else {
      status[name] = 'good'
    }
  }

  return status
}
```

- [ ] **Step 2: 创建实时检查面板**

```typescript
// src/components/CheckPanel.tsx

'use client'

import { useState, useEffect } from 'react'
import { getSectionStatus, parseSections } from '@/lib/utils'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

interface CheckPanelProps {
  content: string
}

export function CheckPanel({ content }: CheckPanelProps) {
  const [status, setStatus] = useState<Record<string, 'empty' | 'short' | 'good'>>({})
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  useEffect(() => {
    setStatus(getSectionStatus(content))
  }, [content])

  // 实时 AI 检查（延迟触发，避免频繁调用）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (content.trim().length < 50) return

      try {
        const response = await fetch('/api/reports/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        const data = await response.json()
        setAiSuggestions(data.suggestions || [])
      } catch (error) {
        setAiSuggestions([])
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [content])

  const sections = parseSections(content)

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="font-medium">填写进度</div>
      
      <div className="space-y-2">
        {Object.entries(sections).map(([name, sectionContent]) => {
          const sectionStatus = status[name] || 'empty'
          const Icon = sectionStatus === 'good' ? CheckCircle : 
                       sectionStatus === 'short' ? AlertCircle : XCircle
          const color = sectionStatus === 'good' ? 'text-green-500' :
                        sectionStatus === 'short' ? 'text-yellow-500' : 'text-red-500'
          
          return (
            <div key={name} className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-sm">{name}</span>
              {sectionStatus === 'short' && (
                <span className="text-xs text-muted-foreground">建议补充更多细节</span>
              )}
              {sectionStatus === 'empty' && (
                <span className="text-xs text-muted-foreground">未填写</span>
              )}
            </div>
          )
        })}
      </div>

      {aiSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">AI 建议</div>
          <div className="space-y-1">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="text-sm text-muted-foreground">
                • {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建评分面板**

```typescript
// src/components/ScorePanel.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ScorePanelProps {
  content: string
  onConfirm: () => void
  onCancel: () => void
}

export function ScorePanel({ content, onConfirm, onCancel }: ScorePanelProps) {
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<{
    structure: number
    content: number
    value: number
    overall: number
  } | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])

  async function checkScore() {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      setScore(data.score)
      setSuggestions(data.suggestions || [])
    } catch (error) {
      setScore({ structure: 0, content: 0, value: 0, overall: 0 })
      setSuggestions(['评分失败'])
    } finally {
      setLoading(false)
    }
  }

  if (!score && !loading) {
    return (
      <div className="p-4 border rounded-lg space-y-4">
        <div className="text-center">
          <p>点击下方按钮进行周报评分</p>
        </div>
        <div className="flex justify-center gap-4">
          <Button onClick={checkScore}>开始评分</Button>
          <Button variant="outline" onClick={onCancel}>取消</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 border rounded-lg text-center">
        正在评分中...
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="text-center font-medium text-lg">
        周报评分：{score?.overall || 0}分
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-sm text-muted-foreground">结构完整度</div>
          <div className="font-medium">{score?.structure || 0}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">内容充实度</div>
          <div className="font-medium">{score?.content || 0}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">价值突出度</div>
          <div className="font-medium">{score?.value || 0}</div>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">改进建议</div>
          <div className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="text-sm text-muted-foreground">
                • {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center gap-4">
        <Button onClick={onConfirm}>确认保存</Button>
        <Button variant="outline" onClick={onCancel}>返回修改</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils.ts src/components/CheckPanel.tsx src/components/ScorePanel.tsx
git commit -m "feat: add check and score UI components"
```

---

### Task 8: 集成到新建周报页面

**Files:**
- Modify: `src/app/new/page.tsx`

- [ ] **Step 1: 修改新建周报页面**

替换整个 `src/app/new/page.tsx`：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { CheckPanel } from '@/components/CheckPanel'
import { ScorePanel } from '@/components/ScorePanel'
import { getWeekRange, formatDate } from '@/lib/utils'
import { getWeek, getYear, addWeeks, subWeeks } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const { start, end } = getWeekRange(baseDate)
  const weekStart = formatDate(start)
  const weekEnd = formatDate(end)
  const year = getYear(baseDate)
  const weekNumber = getWeek(baseDate, { weekStartsOn: 1 })

  const defaultTitle = `${year}年第${weekNumber}周工作周报`
  const [title, setTitle] = useState(defaultTitle)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
      if (data.templates?.length > 0) {
        const defaultTemplate = data.templates.find((t: Template) => t.isDefault)
        setSelectedTemplate(defaultTemplate || data.templates[0])
        setContent(defaultTemplate?.content || data.templates[0]?.content || '')
      }
    } catch (error) {
      toast.error('加载模板失败')
    }
  }

  function goToPrevWeek() {
    const newDate = subWeeks(baseDate, 1)
    setBaseDate(newDate)
    const newYear = getYear(newDate)
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 })
    setTitle(`${newYear}年第${newWeekNumber}周工作周报`)
  }

  function goToNextWeek() {
    const newDate = addWeeks(baseDate, 1)
    setBaseDate(newDate)
    const newYear = getYear(newDate)
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 })
    setTitle(`${newYear}年第${newWeekNumber}周工作周报`)
  }

  function handleTemplateChange(templateId: number) {
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      setContent(template.content)
    }
  }

  async function handleSubmit() {
    if (!content.trim()) {
      toast.error('请填写周报内容')
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
          weekStart,
          weekEnd,
        }),
      })

      if (response.ok) {
        toast.success('周报已创建')
        router.push('/')
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  function handleSaveClick() {
    setShowScorePanel(true)
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">新建周报</h1>
      </div>

      <form className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" size="icon" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium">
            {year}年第{weekNumber}周 ({weekStart} ~ {weekEnd})
          </div>
          <Button type="button" variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template">模板</Label>
            <select
              id="template"
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={selectedTemplate?.id || ''}
              onChange={(e) => handleTemplateChange(parseInt(e.target.value))}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault && ' (默认)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>内容</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
          <div>
            <CheckPanel content={content} />
          </div>
        </div>

        {showScorePanel ? (
          <ScorePanel
            content={content}
            onConfirm={handleSubmit}
            onCancel={() => setShowScorePanel(false)}
          />
        ) : (
          <div className="flex justify-end gap-4">
            <Link href="/">
              <Button type="button" variant="outline">
                取消
              </Button>
            </Link>
            <Button type="button" onClick={handleSaveClick} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </form>
    </main>
  )
}
```

- [ ] **Step 2: 测试新建周报页面**

访问 http://localhost:6868/new，验证：
- 显示模板选择下拉菜单
- 默认加载默认模板内容
- 右侧显示实时检查面板
- 点击保存显示评分面板
- 可以切换模板

- [ ] **Step 3: Commit**

```bash
git add src/app/new/page.tsx
git commit -m "feat: integrate template and AI check into new report page"
```

---

### Task 9: 集成到编辑周报页面

**Files:**
- Modify: `src/app/edit/[id]/page.tsx`

- [ ] **Step 1: 修改编辑周报页面**

在 `src/app/edit/[id]/page.tsx` 中添加智能检查功能：

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { CheckPanel } from '@/components/CheckPanel'
import { ScorePanel } from '@/components/ScorePanel'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/lib/db/schema'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [showScorePanel, setShowScorePanel] = useState(false)

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/${id}`)
        if (response.ok) {
          const report: Report = await response.json()
          setTitle(report.title)
          setContent(report.content)
          setWeekStart(report.weekStart)
          setWeekEnd(report.weekEnd)
        } else {
          toast.error('周报不存在')
          router.push('/')
        }
      } catch (error) {
        toast.error('加载失败')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id, router])

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error('请填写所有必填项')
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
          weekStart,
          weekEnd,
        }),
      })

      if (response.ok) {
        toast.success('周报已更新')
        router.push('/')
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败，请重试')
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
    <main className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">编辑周报</h1>
      </div>

      <form className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>开始日期（周一）</Label>
            <div className="text-sm text-muted-foreground py-1.5">{weekStart}</div>
          </div>
          <div className="space-y-2">
            <Label>结束日期（周日）</Label>
            <div className="text-sm text-muted-foreground py-1.5">{weekEnd}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>内容</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
          <div>
            <CheckPanel content={content} />
          </div>
        </div>

        {showScorePanel ? (
          <ScorePanel
            content={content}
            onConfirm={handleSubmit}
            onCancel={() => setShowScorePanel(false)}
          />
        ) : (
          <div className="flex justify-end gap-4">
            <Link href="/">
              <Button type="button" variant="outline">
                取消
              </Button>
            </Link>
            <Button type="button" onClick={() => setShowScorePanel(true)} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </form>
    </main>
  )
}
```

- [ ] **Step 2: 测试编辑周报页面**

创建一个周报后，点击编辑，验证：
- 显示原有的内容
- 右侧显示实时检查面板
- 点击保存显示评分面板

- [ ] **Step 3: Commit**

```bash
git add src/app/edit/[id]/page.tsx
git commit -m "feat: add AI check to edit report page"
```

---

### Task 10: 添加首页模板入口

**Files:**
- Modify: `src/components/ReportList.tsx`

- [ ] **Step 1: 在首页添加模板管理入口**

在 `src/components/ReportList.tsx` 的按钮区域添加模板管理链接：

```typescript
// 在导入区域添加
import { FileText } from 'lucide-react'

// 在按钮区域添加（在 ThemeSwitcher 之后）
<Link href="/templates">
  <Button variant="outline">
    <FileText className="h-4 w-4 mr-2" />
    模板管理
  </Button>
</Link>
```

- [ ] **Step 2: 测试首页**

访问 http://localhost:6868，验证：
- 显示"模板管理"按钮
- 点击可跳转到模板管理页面

- [ ] **Step 3: Commit**

```bash
git add src/components/ReportList.tsx
git commit -m "feat: add template management link to home page"
```

---

### Task 11: 最终测试和验证

- [ ] **Step 1: 测试完整流程**

1. 访问 http://localhost:6868/templates，查看默认模板
2. 创建新的自定义模板
3. 访问 http://localhost:6868/new，选择模板
4. 编辑周报内容，观察实时检查面板
5. 点击保存，查看评分面板
6. 确认保存，验证周报成功创建
7. 编辑已创建的周报，验证智能检查功能

- [ ] **Step 2: 检查数据库**

```bash
sqlite3 ~/.local/share/weekly-reporter/reports.db "SELECT * FROM templates"
sqlite3 ~/.local/share/weekly-reporter/reports.db "SELECT * FROM reports"
```

Expected: templates 表有默认模板和自定义模板，reports 表有新周报

- [ ] **Step 3: 清理和最终 Commit**

```bash
git status
git add -A
git commit -m "feat: complete weekly report assistant with templates and AI check"
```

---

## Summary

完成以上 11 个任务后，周报编辑器将具备：

1. **模板系统**
   - 默认周报模板
   - 用户可创建自定义模板
   - 模板管理页面

2. **智能建议**
   - 实时检查面板（显示填写进度和 AI 建议）
   - 完成后评分面板（三维度评分 + 改进建议）
   - AI API 集成（需要配置 API Key）

3. **UI 集成**
   - 新建周报页面集成模板选择和智能检查
   - 编辑周报页面集成智能检查
   - 首页添加模板管理入口