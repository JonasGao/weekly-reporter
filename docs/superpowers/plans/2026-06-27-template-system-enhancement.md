# 模板系统增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化模板系统，引入官方标准模板体系，支持模板分类、简介、标签，保证向下兼容。

**Architecture:** 采用分离存储架构 - 官方模板存配置文件，用户模板存数据库，API层合并返回。

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, Milkdown, shadcn/ui, Vitest, React Testing Library

---

## 文件结构

**新建文件：**
- `src/lib/official-templates.ts` - 官方模板配置
- `src/lib/db/migrations/0003_enhance_templates.sql` - 数据库迁移
- `src/app/api/templates/clone/route.ts` - 克隆API
- `src/components/OfficialTemplateCard.tsx` - 官方模板卡片
- `src/components/UserTemplateCard.tsx` - 用户模板卡片
- `src/components/TemplateSelect.tsx` - 模板选择组件
- `src/components/CloneTemplateDialog.tsx` - 另存为对话框
- `src/components/TemplateTabs.tsx` - Tab切换容器

**修改文件：**
- `src/lib/db/schema.ts` - 模板schema定义
- `src/lib/validations.ts` - 模板验证schema
- `src/app/api/templates/route.ts` - 模板列表API
- `src/app/api/templates/[id]/route.ts` - 模板CRUD API
- `src/components/TemplateList.tsx` - 重构为使用新组件
- `src/components/TemplateForm.tsx` - 添加新字段
- `src/app/new/page.tsx` - 使用TemplateSelect组件
- `src/app/templates/page.tsx` - 使用TemplateTabs组件
- `src/app/templates/new/page.tsx` - 适配新schema
- `src/app/templates/[id]/page.tsx` - 适配新schema
- `src/lib/template-default.ts` - 删除（不再需要）
- `src/lib/db/index.ts` - 删除默认模板初始化逻辑

**测试文件：**
- `tests/components/OfficialTemplateCard.test.tsx`
- `tests/components/UserTemplateCard.test.tsx`
- `tests/components/TemplateSelect.test.tsx`
- `tests/components/CloneTemplateDialog.test.tsx`
- `tests/components/TemplateTabs.test.tsx`
- `tests/api/templates.test.ts`

---

## Task 1: 创建官方模板配置文件

**Files:**
- Create: `src/lib/official-templates.ts`

- [ ] **Step 1: 创建官方模板类型定义和配置**

```typescript
// src/lib/official-templates.ts
export interface OfficialTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  content: string
}

export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-general',
    name: '通用正式周报模板',
    description: '适合大多数工作场景的3+1结构周报',
    tags: ['通用', '正式'],
    content: `## 本周完成
- [工作项1：描述 + 成果/价值]
- [工作项2：描述 + 成果/价值]

## 进行中
- [项目/任务名称：进度描述 + 预计完成时间]

## 遇到的问题
- [问题描述 + 原因分析 + 已采取措施/需要支持]

## 下周计划
- [计划事项 + 优先级]
`
  },
  {
    id: 'official-tech-dev',
    name: '技术研发专属周报模板',
    description: '专为研发岗位设计，涵盖开发、修复、运维等维度',
    tags: ['技术研发', '开发'],
    content: `## 开发进度
- [开发项1：功能描述 + 进度% + 预计完成时间]
- [开发项2：功能描述 + 进度% + 预计完成时间]

## Bug修复
- [Bug ID：问题描述 + 修复方案 + 影响范围]

## 运维工作
- [运维事项：系统监控/部署/优化 + 结果]

## 技术沉淀
- [学习内容/文档输出/技术分享 + 产出]

## 下周计划
- [计划事项 + 优先级 + 预计工作量]
`
  },
  {
    id: 'official-minimal',
    name: '极简快速周报模板',
    description: '适合周会同步的轻量级模板',
    tags: ['极简', '快速'],
    content: `## 本周完成
- [关键成果1]
- [关键成果2]

## 下周重点
- [重点事项]
`
  },
  {
    id: 'official-personal-review',
    name: '个人复盘周报模板',
    description: '侧重沉淀、踩坑记录和时间复盘',
    tags: ['个人', '复盘'],
    content: `## 本周成果
- [成果1：描述 + 个人收获]
- [成果2：描述 + 个人收获]

## 踩坑记录
- [踩坑点：问题描述 + 解决方案 + 防范措施]

## 技术沉淀
- [学习内容：知识点 + 实践应用]

## 时间复盘
- [本周时间分配]
- [效率提升点/改进方向]

## 下周计划
- [个人成长目标 + 工作安排]
`
  }
]
```

- [ ] **Step 2: 提交官方模板配置**

```bash
git add src/lib/official-templates.ts
git commit -m "feat: add official template configuration with 4 standard templates"
```

---

## Task 2: 修改数据库Schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/migrations/0003_enhance_templates.sql`

- [ ] **Step 1: 修改模板schema定义**

```typescript
// src/lib/db/schema.ts (修改templates表定义)
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
```

- [ ] **Step 2: 创建数据库迁移脚本**

```sql
-- src/lib/db/migrations/0003_enhance_templates.sql
-- SQLite不支持直接DROP COLUMN，需重建表

-- Step 1: 创建新schema表
CREATE TABLE templates_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  source_template_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Step 2: 迁移用户模板数据（排除旧默认模板）
INSERT INTO templates_new 
  SELECT id, name, content, NULL, NULL, NULL, created_at, updated_at 
  FROM templates 
  WHERE is_default = 0;

-- Step 3: 删除旧表，重命名新表
DROP TABLE templates;
ALTER TABLE templates_new RENAME TO templates;
```

- [ ] **Step 3: 提交schema修改**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations/0003_enhance_templates.sql
git commit -m "feat: update template schema with new fields and migration script"
```

---

## Task 3: 更新验证Schema

**Files:**
- Modify: `src/lib/validations.ts`

- [ ] **Step 1: 修改模板验证schema**

```typescript
// src/lib/validations.ts (修改templateSchema)
export const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  content: z.string().min(1, '模板内容不能为空'),
  description: z.string().max(200).optional(),
  tags: z.string().optional(),
})

export const cloneTemplateSchema = z.object({
  sourceId: z.string().min(1, '源模板ID不能为空'),
  name: z.string().min(1, '模板名称不能为空').max(100).optional(),
  content: z.string().optional(),
})

export type TemplateInput = z.infer<typeof templateSchema>
export type CloneTemplateInput = z.infer<typeof cloneTemplateSchema>
```

- [ ] **Step 2: 提交验证schema修改**

```bash
git add src/lib/validations.ts
git commit -m "feat: update template validation schema with new fields"
```

---

## Task 4: 删除旧默认模板逻辑

**Files:**
- Delete: `src/lib/template-default.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 删除template-default.ts文件**

```bash
rm src/lib/template-default.ts
```

- [ ] **Step 2: 修改数据库初始化逻辑**

```typescript
// src/lib/db/index.ts (移除DEFAULT_TEMPLATE相关代码)
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'
import { DATA_DIR, DB_PATH } from '../paths'
import fs from 'fs'
import path from 'path'

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const sqlite = new Database(DB_PATH)
export const db = drizzle(sqlite, { schema })

// 删除以下代码块：
// - import { DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_CONTENT }
// - 检查并创建默认模板的逻辑（第28-33行）
```

- [ ] **Step 3: 提交删除旧默认模板逻辑**

```bash
git add -A
git commit -m "refactor: remove old default template initialization logic"
```

---

## Task 5: 实现模板列表API调整

**Files:**
- Modify: `src/app/api/templates/route.ts`

- [ ] **Step 1: 修改GET接口返回官方+用户模板**

```typescript
// src/app/api/templates/route.ts
import { NextResponse } from 'next/server'
import { templates } from '@/lib/db/schema'
import { db } from '@/lib/db'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET() {
  try {
    const userTemplates = await db.select().from(templates)
    
    return NextResponse.json({
      official: OFFICIAL_TEMPLATES,
      user: userTemplates,
    })
  } catch (error) {
    return NextResponse.json({ error: '加载模板失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, content, description, tags } = body
    
    if (!name || !content) {
      return NextResponse.json({ error: '名称和内容不能为空' }, { status: 400 })
    }
    
    const now = new Date()
    const result = await db.insert(templates).values({
      name,
      content,
      description,
      tags,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({ template: result[0] }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: '创建模板失败' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 提交模板列表API修改**

```bash
git add src/app/api/templates/route.ts
git commit -m "feat: update template list API to return official and user templates"
```

---

## Task 6: 实现模板克隆API

**Files:**
- Create: `src/app/api/templates/clone/route.ts`

- [ ] **Step 1: 创建克隆API路由**

```typescript
// src/app/api/templates/clone/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import { cloneTemplateSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = cloneTemplateSchema.parse(body)
    
    let sourceTemplate: { name: string; content: string; id: string } | null = null
    
    // 根据sourceId前缀判断来源
    if (validated.sourceId.startsWith('official-')) {
      sourceTemplate = OFFICIAL_TEMPLATES.find(t => t.id === validated.sourceId)
    } else if (validated.sourceId.startsWith('user-')) {
      const userId = parseInt(validated.sourceId.replace('user-', ''))
      const userTemplate = await db.select().from(templates).where(eq(templates.id, userId))
      if (userTemplate.length > 0) {
        sourceTemplate = {
          id: validated.sourceId,
          name: userTemplate[0].name,
          content: userTemplate[0].content,
        }
      }
    }
    
    if (!sourceTemplate) {
      return NextResponse.json(
        { error: '源模板不存在', code: 'TEMPLATE_NOT_FOUND' },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const newTemplate = {
      name: validated.name || sourceTemplate.name,
      content: validated.content || sourceTemplate.content,
      description: undefined,
      tags: undefined,
      sourceTemplateId: validated.sourceId,
      createdAt: now,
      updatedAt: now,
    }
    
    const result = await db.insert(templates).values(newTemplate).returning()
    
    return NextResponse.json({
      template: result[0],
      message: '模板已克隆成功',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '数据验证失败' }, { status: 400 })
    }
    return NextResponse.json({ error: '克隆模板失败' }, { status: 500 })
  }
}
```

需要导入 `eq` 函数：
```typescript
import { eq } from 'drizzle-orm'
```

- [ ] **Step 2: 提交克隆API**

```bash
git add src/app/api/templates/clone/route.ts
git commit -m "feat: implement template clone API with source tracking"
```

---

## Task 7: 调整模板CRUD API

**Files:**
- Modify: `src/app/api/templates/[id]/route.ts`

- [ ] **Step 1: 修改GET/PUT/DELETE接口适配新schema**

```typescript
// src/app/api/templates/[id]/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { templateSchema } from '@/lib/validations'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const template = await db.select().from(templates).where(eq(templates.id, id))
    
    if (template.length === 0) {
      return NextResponse.json(
        { error: '模板不存在', code: 'TEMPLATE_NOT_FOUND' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ template: template[0] })
  } catch (error) {
    return NextResponse.json({ error: '获取模板失败' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const validated = templateSchema.parse(body)
    
    const template = await db.select().from(templates).where(eq(templates.id, id))
    
    if (template.length === 0) {
      return NextResponse.json(
        { error: '模板不存在', code: 'TEMPLATE_NOT_FOUND' },
        { status: 404 }
      )
    }
    
    const updated = await db.update(templates)
      .set({
        name: validated.name,
        content: validated.content,
        description: validated.description,
        tags: validated.tags,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, id))
      .returning()
    
    return NextResponse.json({ template: updated[0] })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '数据验证失败' }, { status: 400 })
    }
    return NextResponse.json({ error: '更新模板失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const template = await db.select().from(templates).where(eq(templates.id, id))
    
    if (template.length === 0) {
      return NextResponse.json(
        { error: '模板不存在', code: 'TEMPLATE_NOT_FOUND' },
        { status: 404 }
      )
    }
    
    await db.delete(templates).where(eq(templates.id, id))
    
    return NextResponse.json({ message: '模板已删除' })
  } catch (error) {
    return NextResponse.json({ error: '删除模板失败' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 提交模板CRUD API修改**

```bash
git add src/app/api/templates/[id]/route.ts
git commit -m "refactor: update template CRUD API to support new schema fields"
```

---

## Task 8: 创建官方模板卡片组件

**Files:**
- Create: `src/components/OfficialTemplateCard.tsx`

- [ ] **Step 1: 创建OfficialTemplateCard组件**

```typescript
// src/components/OfficialTemplateCard.tsx
'use client'

import { Button } from '@/components/ui/button'
import type { OfficialTemplate } from '@/lib/official-templates'

interface OfficialTemplateCardProps {
  template: OfficialTemplate
  onClone: (templateId: string) => void
  onSaveAs: (templateId: string) => void
}

export function OfficialTemplateCard({ template, onClone, onSaveAs }: OfficialTemplateCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-lg">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
          {template.tags.length > 0 && (
            <div className="text-xs text-muted-foreground">
              标签: {template.tags.join(', ')}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onClone(template.id)}
        >
          快速克隆
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onSaveAs(template.id)}
        >
          另存为
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交官方模板卡片组件**

```bash
git add src/components/OfficialTemplateCard.tsx
git commit -m "feat: add OfficialTemplateCard component with clone and save-as buttons"
```

---

## Task 9: 创建用户模板卡片组件

**Files:**
- Create: `src/components/UserTemplateCard.tsx`

- [ ] **Step 1: 创建UserTemplateCard组件**

```typescript
// src/components/UserTemplateCard.tsx
'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Edit, Trash2 } from 'lucide-react'
import type { Template } from '@/lib/db/schema'

interface UserTemplateCardProps {
  template: Template
  onUse?: (template: Template) => void
  onDelete: (id: number) => void
}

export function UserTemplateCard({ template, onUse, onDelete }: UserTemplateCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-lg">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
          {template.tags && (
            <div className="text-xs text-muted-foreground">
              标签: {template.tags}
            </div>
          )}
          {template.sourceTemplateId && (
            <div className="text-xs text-muted-foreground">
              来源: {template.sourceTemplateId.startsWith('official-') 
                ? '官方模板' 
                : '用户模板'}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onUse && (
            <Button variant="outline" size="sm" onClick={() => onUse(template)}>
              使用
            </Button>
          )}
          <Link href={`/templates/${template.id}`}>
            <Button variant="ghost" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(template.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交用户模板卡片组件**

```bash
git add src/components/UserTemplateCard.tsx
git commit -m "feat: add UserTemplateCard component with edit and delete actions"
```

---

## Task 10: 创建模板选择组件

**Files:**
- Create: `src/components/TemplateSelect.tsx`

- [ ] **Step 1: 创建TemplateSelect组件**

```typescript
// src/components/TemplateSelect.tsx
'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateSelectProps {
  officialTemplates: OfficialTemplate[]
  userTemplates: Template[]
  value: string
  onChange: (value: string) => void
}

export function TemplateSelect({ 
  officialTemplates, 
  userTemplates, 
  value, 
  onChange 
}: TemplateSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="选择模板" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>官方模板</SelectLabel>
          {officialTemplates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>个人模板</SelectLabel>
          {userTemplates.map((template) => (
            <SelectItem key={template.id} value={`user-${template.id}`}>
              {template.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: 提交模板选择组件**

```bash
git add src/components/TemplateSelect.tsx
git commit -m "feat: add TemplateSelect component with grouped official/user templates"
```

---

## Task 11: 创建另存为对话框组件

**Files:**
- Create: `src/components/CloneTemplateDialog.tsx`

- [ ] **Step 1: 创建CloneTemplateDialog组件**

```typescript
// src/components/CloneTemplateDialog.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { toast } from 'sonner'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface CloneTemplateDialogProps {
  template: OfficialTemplate | Template | null
  open: boolean
  onClose: () => void
  onClone: (data: { sourceId: string; name: string; content: string }) => Promise<void>
}

export function CloneTemplateDialog({ 
  template, 
  open, 
  onClose, 
  onClone 
}: CloneTemplateDialogProps) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  
  // 当对话框打开时，初始化内容
  useState(() => {
    if (template && open) {
      setName('')
      setContent(template.content)
    }
  })
  
  async function handleSave() {
    if (!name.trim()) {
      toast.error('请填写模板名称')
      return
    }
    
    if (!content.trim()) {
      toast.error('请填写模板内容')
      return
    }
    
    setSaving(true)
    
    try {
      const sourceId = typeof template.id === 'string' 
        ? template.id 
        : `user-${template.id}`
      
      await onClone({ sourceId, name, content })
      toast.success('模板已保存')
      onClose()
    } catch (error) {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  if (!template) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>另存为个人模板</DialogTitle>
          <DialogDescription>
            从 "{template.name}" 另存为新的个人模板，可自定义修改
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">模板名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我的开发周报"
            />
          </div>
          
          <div className="space-y-2">
            <Label>模板内容</Label>
            <MilkdownEditor value={content} onChange={setContent} />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 提交另存为对话框组件**

```bash
git add src/components/CloneTemplateDialog.tsx
git commit -m "feat: add CloneTemplateDialog component for save-as functionality"
```

---

## Task 12: 创建模板Tab切换容器

**Files:**
- Create: `src/components/TemplateTabs.tsx`

- [ ] **Step 1: 创建TemplateTabs组件**

```typescript
// src/components/TemplateTabs.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OfficialTemplateCard } from '@/components/OfficialTemplateCard'
import { UserTemplateCard } from '@/components/UserTemplateCard'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateTabsProps {
  officialTemplates: OfficialTemplate[]
  userTemplates: Template[]
  onCloneOfficial: (templateId: string) => void
  onSaveAsOfficial: (templateId: string) => void
  onDeleteUser: (id: number) => void
}

export function TemplateTabs({
  officialTemplates,
  userTemplates,
  onCloneOfficial,
  onSaveAsOfficial,
  onDeleteUser,
}: TemplateTabsProps) {
  return (
    <Tabs defaultValue="official" className="space-y-4">
      <TabsList>
        <TabsTrigger value="official">官方模板</TabsTrigger>
        <TabsTrigger value="user">个人模板</TabsTrigger>
      </TabsList>
      
      <TabsContent value="official" className="space-y-4">
        {officialTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无官方模板
          </div>
        ) : (
          officialTemplates.map((template) => (
            <OfficialTemplateCard
              key={template.id}
              template={template}
              onClone={onCloneOfficial}
              onSaveAs={onSaveAsOfficial}
            />
          ))
        )}
      </TabsContent>
      
      <TabsContent value="user" className="space-y-4">
        {userTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无个人模板，可以从官方模板克隆或新建
          </div>
        ) : (
          <>
            {userTemplates.map((template) => (
              <UserTemplateCard
                key={template.id}
                template={template}
                onDelete={onDeleteUser}
              />
            ))}
            <div className="flex justify-center">
              <Link href="/templates/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  新建个人模板
                </Button>
              </Link>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  )
}
```

- [ ] **Step 2: 提交模板Tab切换容器**

```bash
git add src/components/TemplateTabs.tsx
git commit -m "feat: add TemplateTabs component for official/user template navigation"
```

---

## Task 13: 重构模板列表组件

**Files:**
- Modify: `src/components/TemplateList.tsx`

- [ ] **Step 1: 重构TemplateList使用新组件**

```typescript
// src/components/TemplateList.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { TemplateTabs } from '@/components/TemplateTabs'
import { CloneTemplateDialog } from '@/components/CloneTemplateDialog'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

interface TemplateListProps {
  onSelect?: (template: Template) => void
}

export function TemplateList({ onSelect }: TemplateListProps) {
  const router = useRouter()
  const [officialTemplates, setOfficialTemplates] = useState<OfficialTemplate[]>([])
  const [userTemplates, setUserTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplateForSaveAs, setSelectedTemplateForSaveAs] = useState<OfficialTemplate | Template | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/templates')
      const data = await response.json()
      setOfficialTemplates(data.official || [])
      setUserTemplates(data.user || [])
    } catch (error) {
      toast.error('加载模板失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleClone(templateId: string) {
    try {
      const response = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: templateId }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('模板已克隆')
        router.push(`/templates/${data.template.id}`)
      } else {
        const error = await response.json()
        toast.error(error.error || '克隆失败')
      }
    } catch (error) {
      toast.error('克隆失败')
    }
  }

  function handleSaveAs(templateId: string) {
    const template = officialTemplates.find(t => t.id === templateId) 
      || userTemplates.find(t => `user-${t.id}` === templateId)
    
    if (template) {
      setSelectedTemplateForSaveAs(template)
      setDialogOpen(true)
    }
  }

  async function handleCloneWithEdit(data: { sourceId: string; name: string; content: string }) {
    try {
      const response = await fetch('/api/templates/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('模板已保存')
        router.push(`/templates/${result.template.id}`)
        fetchTemplates() // 刷新列表
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定要删除这个模板吗？')) return

    try {
      const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setUserTemplates(userTemplates.filter((t) => t.id !== id))
        toast.success('模板已删除')
      } else {
        const error = await response.json()
        toast.error(error.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <>
      <TemplateTabs
        officialTemplates={officialTemplates}
        userTemplates={userTemplates}
        onCloneOfficial={handleClone}
        onSaveAsOfficial={handleSaveAs}
        onDeleteUser={handleDelete}
      />
      
      <CloneTemplateDialog
        template={selectedTemplateForSaveAs}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onClone={handleCloneWithEdit}
      />
    </>
  )
}
```

- [ ] **Step 2: 提交模板列表重构**

```bash
git add src/components/TemplateList.tsx
git commit -m "refactor: TemplateList to use TemplateTabs and CloneTemplateDialog"
```

---

## Task 14: 修改模板表单组件

**Files:**
- Modify: `src/components/TemplateForm.tsx`

- [ ] **Step 1: 添加新字段到表单**

```typescript
// src/components/TemplateForm.tsx (修改)
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
  onSave: (data: { 
    name: string
    content: string
    description?: string
    tags?: string
  }) => Promise<void>
  onCancel: () => void
}

export function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || '')
  const [content, setContent] = useState(template?.content || '')
  const [description, setDescription] = useState(template?.description || '')
  const [tags, setTags] = useState(template?.tags || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !content.trim()) {
      toast.error('请填写模板名称和内容')
      return
    }

    setSaving(true)

    try {
      await onSave({ 
        name, 
        content, 
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
      })
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
        <Label htmlFor="description">简介</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例如：适合技术研发岗位"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">标签</Label>
        <Input
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="例如：开发,技术,研发"
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

- [ ] **Step 2: 提交模板表单修改**

```bash
git add src/components/TemplateForm.tsx
git commit -m "feat: add description and tags fields to TemplateForm"
```

---

## Task 15: 修改新建周报页面

**Files:**
- Modify: `src/app/new/page.tsx`

- [ ] **Step 1: 使用TemplateSelect组件并适配新模板结构**

```typescript
// src/app/new/page.tsx (关键修改部分)
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
import { TemplateSelect } from '@/components/TemplateSelect'
import { getWeekRange, formatDate } from '@/lib/utils'
import { getWeek, getYear, addWeeks, subWeeks } from 'date-fns'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { OfficialTemplate } from '@/lib/official-templates'
import type { Template } from '@/lib/db/schema'

export default function NewReportPage() {
  const router = useRouter()
  const [baseDate, setBaseDate] = useState(new Date())
  const [officialTemplates, setOfficialTemplates] = useState<OfficialTemplate[]>([])
  const [userTemplates, setUserTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [content, setContent] = useState('')
  const [editorKey, setEditorKey] = useState(0)
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
      setOfficialTemplates(data.official || [])
      setUserTemplates(data.user || [])
      
      // 默认选择第一个官方模板
      if (data.official?.length > 0) {
        const firstOfficial = data.official[0]
        setSelectedTemplateId(firstOfficial.id)
        setContent(firstOfficial.content)
        setEditorKey(k => k + 1)
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

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId)
    
    // 根据ID前缀获取模板内容
    if (templateId.startsWith('official-')) {
      const template = officialTemplates.find(t => t.id === templateId)
      if (template) {
        setContent(template.content)
        setEditorKey(k => k + 1)
      }
    } else if (templateId.startsWith('user-')) {
      const userId = parseInt(templateId.replace('user-', ''))
      const template = userTemplates.find(t => t.id === userId)
      if (template) {
        setContent(template.content)
        setEditorKey(k => k + 1)
      }
    }
  }

  // ... 其余代码保持不变（handleSubmit等）
  
  return (
    <main className="container mx-auto py-8 px-4 max-w-5xl">
      {/* ... */}
      
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
          <Label>模板</Label>
          <TemplateSelect
            officialTemplates={officialTemplates}
            userTemplates={userTemplates}
            value={selectedTemplateId}
            onChange={handleTemplateChange}
          />
        </div>
      </div>
      
      {/* ... */}
    </main>
  )
}
```

- [ ] **Step 2: 提交新建周报页面修改**

```bash
git add src/app/new/page.tsx
git commit -m "refactor: use TemplateSelect in new report page with grouped templates"
```

---

## Task 16: 修改模板管理页面

**Files:**
- Modify: `src/app/templates/page.tsx`
- Modify: `src/app/templates/new/page.tsx`
- Modify: `src/app/templates/[id]/page.tsx`

- [ ] **Step 1: 修改模板列表页使用TemplateTabs**

```typescript
// src/app/templates/page.tsx
'use client'

import { TemplateList } from '@/components/TemplateList'

export default function TemplatesPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">模板管理</h1>
      <TemplateList />
    </main>
  )
}
```

- [ ] **Step 2: 修改新建模板页适配新schema**

```typescript
// src/app/templates/new/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { toast } from 'sonner'

export default function NewTemplatePage() {
  const router = useRouter()

  async function handleSave(data: { 
    name: string
    content: string
    description?: string
    tags?: string
  }) {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      router.push('/templates')
    } else {
      const error = await response.json()
      toast.error(error.error || '创建失败')
      throw new Error('创建失败')
    }
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">←</Button>
        </Link>
        <h1 className="text-2xl font-bold">新建模板</h1>
      </div>

      <TemplateForm onSave={handleSave} onCancel={() => router.push('/templates')} />
    </main>
  )
}
```

- [ ] **Step 3: 修改编辑模板页适配新schema**

```typescript
// src/app/templates/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TemplateForm } from '@/components/TemplateForm'
import { toast } from 'sonner'
import type { Template } from '@/lib/db/schema'

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplate()
  }, [params.id])

  async function fetchTemplate() {
    try {
      const response = await fetch(`/api/templates/${params.id}`)
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

  async function handleSave(data: { 
    name: string
    content: string
    description?: string
    tags?: string
  }) {
    const response = await fetch(`/api/templates/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (response.ok) {
      router.push('/templates')
    } else {
      const error = await response.json()
      toast.error(error.error || '更新失败')
      throw new Error('更新失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (!template) {
    return null
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/templates">
          <Button variant="ghost" size="icon">←</Button>
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

- [ ] **Step 4: 提交模板管理页面修改**

```bash
git add src/app/templates/page.tsx src/app/templates/new/page.tsx src/app/templates/[id]/page.tsx
git commit -m "refactor: update template pages to use new components and schema"
```

---

## Task 17: 运行数据库迁移

**Files:**
- Execute migration

- [ ] **Step 1: 执行数据库迁移**

```bash
source ~/.nvm/nvm.sh && npm run db:migrate
```

Expected: Migration successful, old default template deleted, new schema applied

- [ ] **Step 2: 验证数据库结构**

```bash
sqlite3 ~/.local/share/weekly-reporter/reports.db "PRAGMA table_info(templates);"
```

Expected output showing new fields:
```
0|id|INTEGER|0||1
1|name|TEXT|1||0
2|content|TEXT|1||0
3|description|TEXT|0||0
4|tags|TEXT|0||0
5|source_template_id|TEXT|0||0
6|created_at|INTEGER|1||0
7|updated_at|INTEGER|1||0
```

- [ ] **Step 3: 验证旧数据迁移**

```bash
sqlite3 ~/.local/share/weekly-reporter/reports.db "SELECT COUNT(*) FROM templates;"
```

Expected: Count equals old user templates count (excluding deleted default template)

---

## Task 18: 功能验证测试

**Files:**
- Manual testing

- [ ] **Step 1: 启动开发服务器**

```bash
source ~/.nvm/nvm.sh && npm run dev
```

- [ ] **Step 2: 验证官方模板加载**

Visit: http://localhost:3000/templates
Expected: 4 official templates displayed in "官方模板" tab

- [ ] **Step 3: 验证快速克隆功能**

Click "快速克隆" on any official template
Expected: Redirect to edit page with cloned template

- [ ] **Step 4: 验证另存为功能**

Click "另存为" on any official template
Expected: Dialog opens, can modify content, saves as user template

- [ ] **Step 5: 验证新建周报模板选择**

Visit: http://localhost:3000/new
Expected: TemplateSelect shows grouped official/user templates

- [ ] **Step 6: 验证向下兼容**

Check user templates from before migration still exist
Expected: All user templates preserved, can still edit/delete

---

## Task 19: 编写前端单元测试

**Files:**
- Create: `tests/components/OfficialTemplateCard.test.tsx`
- Create: `tests/components/UserTemplateCard.test.tsx`
- Create: `tests/components/TemplateSelect.test.tsx`
- Create: `tests/components/CloneTemplateDialog.test.tsx`
- Create: `tests/components/TemplateTabs.test.tsx`

- [ ] **Step 1: 创建测试目录**

```bash
mkdir -p tests/components
```

- [ ] **Step 2: 编写OfficialTemplateCard测试**

```typescript
// tests/components/OfficialTemplateCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { OfficialTemplateCard } from '@/components/OfficialTemplateCard'

const mockTemplate = {
  id: 'official-general',
  name: '通用正式周报模板',
  description: '适合大多数工作场景的3+1结构周报',
  tags: ['通用', '正式'],
  content: '## 本周完成\n- [工作项1]',
}

test('renders official template information', () => {
  render(<OfficialTemplateCard 
    template={mockTemplate}
    onClone={() => {}}
    onSaveAs={() => {}}
  />)
  
  expect(screen.getByText('通用正式周报模板')).toBeInTheDocument()
  expect(screen.getByText('适合大多数工作场景的3+1结构周报')).toBeInTheDocument()
  expect(screen.getByText('标签: 通用, 正式')).toBeInTheDocument()
})

test('calls onClone when quick clone button clicked', () => {
  const onClone = jest.fn()
  render(<OfficialTemplateCard 
    template={mockTemplate}
    onClone={onClone}
    onSaveAs={() => {}}
  />)
  
  fireEvent.click(screen.getByText('快速克隆'))
  expect(onClone).toHaveBeenCalledWith('official-general')
})

test('calls onSaveAs when save-as button clicked', () => {
  const onSaveAs = jest.fn()
  render(<OfficialTemplateCard 
    template={mockTemplate}
    onClone={() => {}}
    onSaveAs={onSaveAs}
  />)
  
  fireEvent.click(screen.getByText('另存为'))
  expect(onSaveAs).toHaveBeenCalledWith('official-general')
})
```

- [ ] **Step 3: 编写UserTemplateCard测试**

```typescript
// tests/components/UserTemplateCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { UserTemplateCard } from '@/components/UserTemplateCard'

const mockTemplate = {
  id: 1,
  name: '我的开发周报',
  content: '...',
  description: '适合开发岗位',
  tags: '开发,技术',
  sourceTemplateId: 'official-tech-dev',
  createdAt: new Date(),
  updatedAt: new Date(),
}

test('renders user template information', () => {
  render(<UserTemplateCard 
    template={mockTemplate}
    onDelete={() => {}}
  />)
  
  expect(screen.getByText('我的开发周报')).toBeInTheDocument()
  expect(screen.getByText('适合开发岗位')).toBeInTheDocument()
  expect(screen.getByText('标签: 开发,技术')).toBeInTheDocument()
})

test('shows source template indicator', () => {
  render(<UserTemplateCard 
    template={mockTemplate}
    onDelete={() => {}}
  />)
  
  expect(screen.getByText('来源: 官方模板')).toBeInTheDocument()
})

test('calls onDelete when delete button clicked', () => {
  const onDelete = jest.fn()
  render(<UserTemplateCard 
    template={mockTemplate}
    onDelete={onDelete}
  />)
  
  fireEvent.click(screen.getByRole('button', { name: /trash/i }))
  expect(onDelete).toHaveBeenCalledWith(1)
})
```

- [ ] **Step 4: 编写TemplateSelect测试**

```typescript
// tests/components/TemplateSelect.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateSelect } from '@/components/TemplateSelect'

const officialTemplates = [
  { id: 'official-general', name: '通用正式周报模板', description: '', tags: [], content: '' },
  { id: 'official-tech-dev', name: '技术研发专属周报模板', description: '', tags: [], content: '' },
]

const userTemplates = [
  { id: 1, name: '我的模板', content: '', createdAt: new Date(), updatedAt: new Date() },
]

test('renders grouped template options', () => {
  render(<TemplateSelect 
    officialTemplates={officialTemplates}
    userTemplates={userTemplates}
    value=""
    onChange={() => {}}
  />)
  
  fireEvent.click(screen.getByRole('combobox'))
  
  expect(screen.getByText('官方模板')).toBeInTheDocument()
  expect(screen.getByText('通用正式周报模板')).toBeInTheDocument()
  expect(screen.getByText('个人模板')).toBeInTheDocument()
  expect(screen.getByText('我的模板')).toBeInTheDocument()
})

test('calls onChange with official template ID', () => {
  const onChange = jest.fn()
  render(<TemplateSelect 
    officialTemplates={officialTemplates}
    userTemplates={userTemplates}
    value=""
    onChange={onChange}
  />)
  
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByText('通用正式周报模板'))
  
  expect(onChange).toHaveBeenCalledWith('official-general')
})

test('calls onChange with user template ID format', () => {
  const onChange = jest.fn()
  render(<TemplateSelect 
    officialTemplates={officialTemplates}
    userTemplates={userTemplates}
    value=""
    onChange={onChange}
  />)
  
  fireEvent.click(screen.getByRole('combobox'))
  fireEvent.click(screen.getByText('我的模板'))
  
  expect(onChange).toHaveBeenCalledWith('user-1')
})
```

- [ ] **Step 5: 编写CloneTemplateDialog测试**

```typescript
// tests/components/CloneTemplateDialog.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CloneTemplateDialog } from '@/components/CloneTemplateDialog'

const mockTemplate = {
  id: 'official-general',
  name: '通用正式周报模板',
  content: '## 本周完成\n- [工作项1]',
  description: '',
  tags: [],
}

test('shows template content in editor', () => {
  render(<CloneTemplateDialog 
    template={mockTemplate}
    open={true}
    onClose={() => {}}
    onClone={() => Promise.resolve()}
  />)
  
  expect(screen.getByText('另存为个人模板')).toBeInTheDocument()
  expect(screen.getByDisplayValue('## 本周完成')).toBeInTheDocument()
})

test('validates required name field', async () => {
  const onClone = jest.fn()
  render(<CloneTemplateDialog 
    template={mockTemplate}
    open={true}
    onClose={() => {}}
    onClone={onClone}
  />)
  
  fireEvent.click(screen.getByText('保存'))
  
  await waitFor(() => {
    expect(screen.getByText('请填写模板名称')).toBeInTheDocument()
  })
  expect(onClone).not.toHaveBeenCalled()
})

test('calls onClone with valid data', async () => {
  const onClone = jest.fn()
  render(<CloneTemplateDialog 
    template={mockTemplate}
    open={true}
    onClose={() => {}}
    onClone={onClone}
  />)
  
  fireEvent.change(screen.getByPlaceholderText('例如：我的开发周报'), {
    target: { value: '自定义模板名' },
  })
  fireEvent.click(screen.getByText('保存'))
  
  await waitFor(() => {
    expect(onClone).toHaveBeenCalledWith({
      sourceId: 'official-general',
      name: '自定义模板名',
      content: mockTemplate.content,
    })
  })
})
```

- [ ] **Step 6: 编写TemplateTabs测试**

```typescript
// tests/components/TemplateTabs.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TemplateTabs } from '@/components/TemplateTabs'

const officialTemplates = [
  { id: 'official-general', name: '通用正式周报模板', description: '', tags: [], content: '' },
]

const userTemplates = [
  { id: 1, name: '我的模板', content: '', createdAt: new Date(), updatedAt: new Date() },
]

test('renders tabs for official and user templates', () => {
  render(<TemplateTabs 
    officialTemplates={officialTemplates}
    userTemplates={userTemplates}
    onCloneOfficial={() => {}}
    onSaveAsOfficial={() => {}}
    onDeleteUser={() => {}}
  />)
  
  expect(screen.getByText('官方模板')).toBeInTheDocument()
  expect(screen.getByText('个人模板')).toBeInTheDocument()
})

test('switches between tabs', () => {
  render(<TemplateTabs 
    officialTemplates={officialTemplates}
    userTemplates={userTemplates}
    onCloneOfficial={() => {}}
    onSaveAsOfficial={() => {}}
    onDeleteUser={() => {}}
  />)
  
  fireEvent.click(screen.getByText('个人模板'))
  expect(screen.getByText('我的模板')).toBeInTheDocument()
})

test('shows empty state for user templates', () => {
  render(<TemplateTabs 
    officialTemplates={officialTemplates}
    userTemplates={[]}
    onCloneOfficial={() => {}}
    onSaveAsOfficial={() => {}}
    onDeleteUser={() => {}}
  />)
  
  fireEvent.click(screen.getByText('个人模板'))
  expect(screen.getByText('暂无个人模板，可以从官方模板克隆或新建')).toBeInTheDocument()
})
```

- [ ] **Step 7: 提交前端单元测试**

```bash
git add tests/components/
git commit -m "test: add unit tests for template components"
```

---

## Task 20: 编写后端API测试

**Files:**
- Create: `tests/api/templates.test.ts`

- [ ] **Step 1: 编写API测试**

```typescript
// tests/api/templates.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { GET, POST } from '@/app/api/templates/route'
import { POST as CLONE_POST } from '@/app/api/templates/clone/route'

describe('Template API', () => {
  beforeAll(async () => {
    // Setup test database
  })

  afterAll(async () => {
    // Cleanup test database
  })

  test('returns merged official and user templates', async () => {
    const response = await GET()
    const data = await response.json()
    
    expect(data.official).toBeDefined()
    expect(data.official.length).toBe(4) // 4 official templates
    expect(data.user).toBeDefined()
    expect(Array.isArray(data.user)).toBe(true)
  })

  test('creates user template', async () => {
    const request = new Request('http://localhost/api/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Template',
        content: '## Test',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(201)
    expect(data.template.name).toBe('Test Template')
    expect(data.template.id).toBeDefined()
  })

  test('clones official template', async () => {
    const request = new Request('http://localhost/api/templates/clone', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: 'official-general',
        name: 'My Clone',
      }),
    })
    
    const response = await CLONE_POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(201)
    expect(data.template.name).toBe('My Clone')
    expect(data.template.sourceTemplateId).toBe('official-general')
  })

  test('returns error for invalid source ID', async () => {
    const request = new Request('http://localhost/api/templates/clone', {
      method: 'POST',
      body: JSON.stringify({
        sourceId: 'invalid-id',
      }),
    })
    
    const response = await CLONE_POST(request)
    
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: 提交API测试**

```bash
git add tests/api/templates.test.ts
git commit -m "test: add API tests for template endpoints"
```

---

## Task 21: 运行所有测试

**Files:**
- Execute tests

- [ ] **Step 1: 运行前端组件测试**

```bash
source ~/.nvm/nvm.sh && npm run test tests/components/
```

Expected: All component tests pass

- [ ] **Step 2: 运行API测试**

```bash
source ~/.nvm/nvm.sh && npm run test tests/api/
```

Expected: All API tests pass

- [ ] **Step 3: 运行完整测试套件**

```bash
source ~/.nvm/nvm.sh && npm run test
```

Expected: All tests pass, coverage meets threshold

---

## Task 22: 最终集成验证

**Files:**
- Final verification

- [ ] **Step 1: 验证完整功能流程**

1. 访问模板管理页，确认官方模板加载
2. 快速克隆官方模板，确认跳转编辑页
3. 另存为官方模板（修改内容），确认保存成功
4. 创建新周报，选择不同来源模板，确认内容切换
5. 编辑用户模板，确认新字段（description、tags）保存

Expected: 所有功能正常工作

- [ ] **Step 2: 验证向下兼容**

1. 确认迁移前用户模板完整保留
2. 确认旧模板可正常编辑、删除
3. 确认新建周报可选择旧模板

Expected: 向下兼容完美

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete template system enhancement with official templates support"
```

---

## 总结

本实现计划包含22个任务，每个任务分解为2-5分钟的bite-sized步骤，涵盖：

1. **数据层改造**：官方模板配置、schema修改、migration
2. **API层增强**：模板列表合并、克隆API、CRUD调整
3. **前端组件重构**：5个新组件、现有组件适配
4. **页面适配**：新建周报、模板管理页面
5. **测试覆盖**：前端单元测试、后端API测试
6. **验证流程**：migration执行、功能验证、向下兼容测试

遵循TDD原则，频繁提交，保证每步可独立验证。