# P1 模板变量引擎设计规范

## 项目背景

**当前项目**：Next.js 16 + TypeScript + Drizzle + SQLite  
**前置依赖**：已完成P0模板标准化（模板Schema、官方模板配置、模板管理功能）  
**阶段目标**：实现全局模板变量替换引擎（服务端处理），为P2自动填充事件素材预留扩展能力  
**边界限制**：本阶段只做模板变量引擎，禁止做AI自动生成、事件填充

---

## 1. 整体架构设计

### 1.1 核心设计原则

**服务端统一处理**：所有变量解析逻辑收敛在服务端，前端完全不参与替换，只接收纯Markdown内容。

**两个触发时机**：
- **主流程**：POST /api/reports 创建周报时（携带templateId）
- **辅助流程**：GET /api/templates/[id]/render 模板预览时

### 1.2 文件结构

```
src/
├── lib/
│   ├── db/
│   │   └── schema.ts          # 新增config字段
│   ├── template/
│   │   └── render.ts          # 单一渲染函数（新增）
│   └── official-templates.ts   # 官方模板配置（可能需要更新）
│
├── app/
│   ├── api/
│   │   ├── reports/
│   │   │   └── route.ts       # POST时调用renderTemplate（修改）
│   │   └── templates/
│   │       └── [id]/
│   │           └── route.ts   # GET单个模板（现有）
│   │           └── render/
│   │               └── route.ts # GET模板预览（新增）
│   │
│   ├── new/
│   │   └── page.tsx           # 新建周报页面（修改：集成工具栏）
│   └── edit/
│       └── [id]/
│           └── page.tsx       # 编辑周报页面（修改：集成工具栏）
│
└── components/
    └── VariableToolbar.tsx    # 顶部工具栏组件（新增）
```

### 1.3 数据流

```
用户操作 → 前端 → API → 渲染引擎 → 数据库
         ↓
    选择模板/创建周报
         ↓
    调用API（传入templateId + baseDate）
         ↓
    服务端查询模板内容
         ↓
    renderTemplate(content, { date })
         ↓
    返回已解析的纯Markdown
         ↓
    前端编辑器直接渲染（无变量闪烁）
```

---

## 2. 数据层设计

### 2.1 Schema扩展

**修改文件**：`src/lib/db/schema.ts`

新增config字段（JSON类型）：

```typescript
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),
  tags: text('tags'),
  sourceTemplateId: text('source_template_id'),
  config: text('config', { mode: 'json' }).notNull().default({}), // 新增
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// 新增类型定义（预留P2扩展）
export interface TemplateConfig {
  sectionSkeleton?: {
    type: 'unordered' | 'ordered' | 'task'
    placeholderCount: number
  }
}

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
```

### 2.2 Database Migration

**创建迁移文件**：`drizzle/0002_add_template_config.sql`

```sql
ALTER TABLE `templates` ADD COLUMN `config` text NOT NULL DEFAULT '{}';
```

**执行迁移命令**：
```bash
drizzle-kit generate
drizzle-kit migrate
```

### 2.3 P1阶段使用策略

- **完全不读取config字段**，渲染逻辑使用硬编码默认值（3行无序列表）
- **字段仅做预留**，为P2用户可配置骨架做准备
- **官方模板**：代码中硬编码默认config（不需要存数据库）
- **用户模板**：数据库存储config字段（默认值为空对象`{}`）

---

## 3. 服务端渲染引擎设计

### 3.1 核心渲染函数

**新建文件**：`src/lib/template/render.ts`

```typescript
import { format, startOfWeek, endOfWeek, subWeeks, getWeek, getYear, getMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface RenderOptions {
  date?: Date // 基准日期，默认当前时间
}

/**
 * 统一模板变量渲染函数
 * @param content 模板原始内容（带变量）
 * @param options 渲染参数
 * @returns 渲染后的纯 Markdown 内容
 */
export function renderTemplate(content: string, options: RenderOptions = {}): string {
  const baseDate = options.date || new Date()
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  const prevWeekStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })
  const prevWeekEnd = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 })

  let result = content

  // 1. 系统内置变量替换（动态日期变量）
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

  // 2. 区块变量替换（P1阶段：3行空无序列表）
  const sectionVariables = ['核心成果', '问题与风险', '下周计划', '日常事务']
  sectionVariables.forEach(sectionName => {
    const regex = new RegExp(`{{${sectionName}}}`, 'g')
    // 默认生成3行空无序列表项
    result = result.replace(regex, '- \n- \n- ')
  })

  return result
}
```

### 3.2 变量列表定义

**系统内置变量（5个）**：
- `{{本周日期范围}}` → "2026.06.22 - 2026.06.28"
- `{{上周日期范围}}` → "2026.06.15 - 2026.06.21"（相对基准日期）
- `{{当前周数}}` → "第27周"
- `{{年份}}` → "2026"
- `{{月份}}` → "6月"

**区块变量（4个）**：
- `{{核心成果}}` → "- \n- \n- "
- `{{问题与风险}}` → "- \n- \n- "
- `{{下周计划}}` → "- \n- \n- "
- `{{日常事务}}` → "- \n- \n- "

### 3.3 渲染示例

**模板原文**：
```markdown
## 本周完成
{{本周日期范围}}

## 核心成果
{{核心成果}}

## 问题与风险
{{问题与风险}}

## 下周计划
{{下周计划}}
```

**渲染结果**（基准日期：2026-06-27）：
```markdown
## 本周完成
2026.06.22 - 2026.06.28

## 核心成果
- 
- 
- 

## 问题与风险
- 
- 
- 

## 下周计划
- 
- 
- 
```

---

## 4. API接口设计

### 4.1 主流程：创建周报接口（修改现有）

**修改文件**：`src/app/api/reports/route.ts`

修改POST接口，增加templateId参数处理：

```typescript
export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    // 新增：支持templateId参数
    const { title, content, weekStart, weekEnd, templateId, baseDate } = body
    
    // 如果提供了templateId，从模板渲染内容
    let finalContent = content
    if (templateId) {
      // 查询模板内容
      let templateContent: string
      
      if (templateId.startsWith('official-')) {
        // 官方模板：从配置文件获取
        const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
        templateContent = template?.content || ''
      } else {
        // 用户模板：从数据库获取
        const templateIdNum = parseInt(templateId.replace('user-', ''))
        const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
        templateContent = template[0]?.content || ''
      }
      
      // 渲染模板变量
      finalContent = renderTemplate(templateContent, { 
        date: baseDate ? new Date(baseDate) : new Date() 
      })
    }
    
    // 原有的创建周报逻辑
    const now = new Date()
    const result = await db.insert(reports).values({
      title,
      content: finalContent,
      weekStart,
      weekEnd,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({ report: result[0] }, { status: 201 })
  } catch (error) {
    // 错误处理...
  }
}
```

**前端调用方式**（修改）：
```typescript
// src/app/new/page.tsx - handleSubmit()
const response = await fetch('/api/reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title,
    content, // 前端编辑的内容（已渲染）
    weekStart,
    weekEnd,
    templateId: selectedTemplateId, // 新增
    baseDate: baseDate.toISOString(), // 新增
  }),
})
```

### 4.2 辅助流程：模板预览接口（新增）

**新建文件**：`src/app/api/templates/[id]/render/route.ts`

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
    
    const templateId = params.id
    let templateContent: string
    
    // 根据ID前缀获取模板内容
    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (!template) {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 })
      }
      templateContent = template.content
    } else {
      const db = getDb()
      const templateIdNum = parseInt(templateId.replace('user-', ''))
      const template = await db.select().from(templates).where(eq(templates.id, templateIdNum)).limit(1)
      if (!template[0]) {
        return NextResponse.json({ error: '模板不存在' }, { status: 404 })
      }
      templateContent = template[0].content
    }
    
    // 渲染模板变量
    const renderedContent = renderTemplate(templateContent, { date: baseDate })
    
    return NextResponse.json({ 
      content: renderedContent,
      templateId,
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

**前端调用方式**（模板切换时预览）：
```typescript
// GET /api/templates/official-general/render?date=2026-06-27T00:00:00Z
// 返回：{ content: "已渲染的Markdown", templateId: "official-general", baseDate: "..." }
```

---

## 5. 前端工具栏设计

### 5.1 VariableToolbar组件

**新建文件**：`src/components/VariableToolbar.tsx`

```typescript
'use client'

import { useState } from 'react'
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

### 5.2 集成到编辑器页面

**修改文件**：`src/app/new/page.tsx`

在编辑器上方添加工具栏：

```typescript
// 在编辑器Label下方、MilkdownEditor上方添加
<div className="col-span-2 space-y-2">
  <div className="flex items-center justify-between">
    <Label>内容</Label>
    <VariableToolbar onInsertVariable={handleInsertVariable} />
  </div>
  <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
</div>

// 新增handleInsertVariable函数
function handleInsertVariable(variable: string) {
  // 在当前光标位置插入变量
  // 由于Milkdown不提供API直接操作光标，采用简单方案：
  // 在content末尾追加变量 + 换行
  setContent(prev => prev + '\n' + variable + '\n')
  
  // 更新editorKey触发重新渲染
  setEditorKey(k => k + 1)
  
  toast.success(`已插入变量：${variable}`)
}
```

**同样修改**：`src/app/edit/[id]/page.tsx`（编辑页面也集成工具栏）

### 5.3 工具栏交互说明

**位置**：编辑器上方，右侧对齐（不影响Label显示）

**交互流程**：
1. 点击"插入变量"按钮 → 展开Dropdown菜单
2. 菜单分为两个分组：系统变量、区块变量
3. 每个变量项显示：变量名（font-mono）+ 描述文字
4. 点击变量项 → 在编辑器末尾插入变量文本
5. Toast提示插入成功

**限制**：
- P1阶段不支持光标位置插入（Milkdown编辑器API限制）
- 采用末尾追加方案，用户可手动移动位置
- P2阶段可考虑升级为Milkdown插件实现精确插入

---

## 6. 兼容性与错误处理

### 6.1 旧模板兼容性

**原则**：无变量则原样展示，完全向后兼容

**渲染函数兼容逻辑**：
- 正则替换自动处理：找不到匹配项时不替换，原样保留
- 如果内容中没有任何变量，返回原内容

**兼容场景测试**：

1. **旧模板无变量**：
   - 输入：`## 本周完成\n- 工作项1\n- 工作项2`
   - 输出：`## 本周完成\n- 工作项1\n- 工作项2`（完全不变）

2. **模板部分有变量**：
   - 输入：`## 本周完成\n{{本周日期范围}}\n## 下周计划\n- 继续开发`
   - 输出：`## 本周完成\n2026.06.22 - 2026.06.28\n## 下周计划\n- 继续开发`
   - 只替换有变量的部分，其余保留

3. **模板变量拼写错误**：
   - 输入：`{{本周日期}}`（错误拼写）
   - 输出：`{{本周日期}}`（原样保留，不替换）

### 6.2 错误处理策略

**API错误处理**：

```typescript
// src/app/api/templates/[id]/render/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // ...渲染逻辑
  } catch (error) {
    // 分类错误处理
    if (error instanceof Error && error.message.includes('Invalid date')) {
      return NextResponse.json(
        { error: '日期参数无效', code: 'INVALID_DATE' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: '模板渲染失败', code: 'RENDER_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}
```

**前端错误提示**：

```typescript
// src/app/new/page.tsx - handleTemplateChange()
async function handleTemplateChange(templateId: string) {
  setSelectedTemplateId(templateId)
  
  try {
    // 调用预览接口获取渲染后的内容
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

### 6.3 边界场景处理

**场景1：baseDate为null或无效**
- API层验证：`new Date(baseDateStr)` 失败时返回400错误
- 渲染层兜底：`options.date || new Date()` 默认使用当前时间

**场景2：templateId不存在**
- API返回404，前端Toast提示"模板不存在"
- 不影响其他功能，用户可选择其他模板

**场景3：模板content为空字符串**
- 渲染函数正常处理，返回空字符串
- 编辑器显示空内容，用户可手动填写

**场景4：变量名冲突（未来扩展）**
- P1阶段硬编码变量列表，不存在冲突
- P2阶段如增加自定义变量，需建立优先级规则（系统变量优先）

---

## 7. 测试策略与验证

### 7.1 单元测试（渲染函数）

**新建测试文件**：`src/lib/template/render.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'

describe('renderTemplate', () => {
  it('should replace system variables correctly', () => {
    const content = '{{本周日期范围}} {{当前周数}} {{年份}} {{月份}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toContain('2026.06.22 - 2026.06.28')
    expect(result).toContain('第27周')
    expect(result).toContain('2026')
    expect(result).toContain('6月')
  })
  
  it('should calculate last week range relative to base date', () => {
    const content = '{{上周日期范围}}'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toContain('2026.06.15 - 2026.06.21')
  })
  
  it('should replace section variables with 3 empty list items', () => {
    const content = '{{核心成果}}'
    const result = renderTemplate(content)
    
    expect(result).toBe('- \n- \n- ')
  })
  
  it('should preserve content without variables', () => {
    const content = '## 本周完成\n- 工作项1\n- 工作项2'
    const result = renderTemplate(content)
    
    expect(result).toBe(content)
  })
  
  it('should handle partial variables in content', () => {
    const content = '## 本周完成\n{{本周日期范围}}\n## 下周计划\n- 继续开发'
    const result = renderTemplate(content, { date: new Date('2026-06-27') })
    
    expect(result).toContain('2026.06.22 - 2026.06.28')
    expect(result).toContain('- 继续开发')
  })
  
  it('should not replace misspelled variables', () => {
    const content = '{{本周日期}} {{核心成果}}'
    const result = renderTemplate(content)
    
    expect(result).toBe('{{本周日期}} {{核心成果}}')
  })
})
```

### 7.2 前端组件单元测试

**新建测试文件**：`src/components/VariableToolbar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VariableToolbar } from './VariableToolbar'

describe('VariableToolbar', () => {
  it('should render dropdown trigger button', () => {
    const mockInsert = vi.fn()
    render(<VariableToolbar onInsertVariable={mockInsert} />)
    
    expect(screen.getByText('插入变量')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
  
  it('should open dropdown menu when clicked', async () => {
    const mockInsert = vi.fn()
    render(<VariableToolbar onInsertVariable={mockInsert} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(screen.getByText('系统变量')).toBeInTheDocument()
    expect(screen.getByText('区块变量')).toBeInTheDocument()
  })
  
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
  
  it('should display variable descriptions', async () => {
    const mockInsert = vi.fn()
    render(<VariableToolbar onInsertVariable={mockInsert} />)
    
    fireEvent.click(screen.getByRole('button'))
    
    expect(screen.getByText('自动计算本周起止日期')).toBeInTheDocument()
    expect(screen.getByText('核心成果区块骨架')).toBeInTheDocument()
  })
})
```

### 7.3 页面单元测试

**新建测试文件**：`src/app/new/page.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    
    // Mock fetch for templates API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        official: [{ id: 'official-general', name: '通用模板', content: '## {{本周日期范围}}\n{{核心成果}}' }],
        user: [],
      }),
    })
  })
  
  it('should render page title', async () => {
    render(<NewReportPage />)
    
    expect(screen.getByText('新建周报')).toBeInTheDocument()
  })
  
  it('should render week navigation buttons', async () => {
    render(<NewReportPage />)
    
    expect(screen.getByRole('button', { name: /chevronleft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chevronright/i })).toBeInTheDocument()
  })
  
  it('should load templates on mount', async () => {
    render(<NewReportPage />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/templates')
    })
  })
  
  it('should render VariableToolbar component', async () => {
    render(<NewReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
  })
  
  it('should insert variable at end of content when toolbar is used', async () => {
    const user = userEvent.setup()
    render(<NewReportPage />)
    
    await waitFor(() => {
      expect(screen.getByText('插入变量')).toBeInTheDocument()
    })
    
    // Open dropdown
    await user.click(screen.getByText('插入变量'))
    
    // Click variable
    await user.click(screen.getByText('{{本周日期范围}}'))
    
    // Verify toast was called
    expect(vi.mocked(require('sonner').toast.success)).toHaveBeenCalledWith('已插入变量：{{本周日期范围}}')
  })
})
```

**新建测试文件**：`src/app/edit/[id]/page.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  
  it('should load existing report on mount', async () => {
    render(<EditReportPage />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/reports/1')
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

### 7.4 API集成测试

**测试接口**：使用curl或Postman验证

```bash
# 测试模板预览接口
curl "http://localhost:3000/api/templates/official-general/render?date=2026-06-27T00:00:00Z"

# 预期返回：
# {
#   "content": "## 本周完成\n2026.06.22 - 2026.06.28\n...",
#   "templateId": "official-general",
#   "baseDate": "2026-06-27T00:00:00.000Z"
# }

# 测试创建周报接口（带templateId）
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

# 预期：数据库中存储的content是已渲染的Markdown
```

### 7.5 前端功能验证

**验证清单**：

1. **新建周报页面**：
   - 模板选择Dropdown正常工作
   - 选择模板后，编辑器显示已渲染内容（无变量闪烁）
   - 切换基准日期（上周/下周按钮），重新选择模板，日期变量正确更新
   - VariableToolbar工具栏显示在编辑器上方
   - 点击"插入变量"按钮，Dropdown菜单展开
   - 选择变量后，编辑器末尾插入变量文本
   - Toast提示插入成功

2. **模板管理页面**：
   - 模板列表显示原始模板内容（包含{{变量}}）
   - 不影响模板管理功能

3. **编辑周报页面**：
   - 已保存的周报正常显示（已渲染内容）
   - VariableToolbar工具栏可用
   - 编辑后保存正常

### 7.6 兼容性验证

**旧模板测试**：

1. 在数据库中手动插入无变量的旧模板
2. 在新建周报页面选择该模板
3. 验证编辑器显示原始内容（无任何替换）
4. 正常填写并保存

**边界场景测试**：

1. baseDate为无效日期字符串
2. templateId不存在
3. 模板content为空字符串
4. 模板包含拼写错误的变量名

### 7.7 测试运行配置

**修改`vitest.config.ts`**：

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/template/render.ts',
        'src/components/VariableToolbar.tsx',
        'src/app/new/page.tsx',
        'src/app/edit/[id]/page.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**运行测试命令**：

```bash
npm run test              # 运行所有测试
npm run test:coverage     # 运行测试并生成覆盖率报告
npm run test -- --watch   # 监听模式运行测试
```

---

## 8. P2扩展预留

### 8.1 数据层预留

- Schema已预留config字段，支持用户自定义区块样式
- 默认值：`{ sectionSkeleton: { type: 'unordered', placeholderCount: 3 } }`

### 8.2 渲染函数扩展

P2阶段只需修改renderTemplate函数：

```typescript
// P2扩展：增加events参数
interface RenderOptions {
  date?: Date
  events?: RawEvent[] // P2新增：事件素材
}

// P2扩展：区块变量自动填充逻辑
sectionVariables.forEach(sectionName => {
  const regex = new RegExp(`{{${sectionName}}}`, 'g')
  
  // P1: 空列表骨架
  // P2: 根据events自动填充列表项
  const items = events?.filter(e => e.category === sectionName) || []
  const listContent = items.length > 0 
    ? items.map(e => `- ${e.content}`).join('\n')
    : '- \n- \n- ' // 兜底：无事件时仍显示空骨架
  
  result = result.replace(regex, listContent)
})
```

### 8.3 前端不变

- P2阶段前端完全不改，接口不变
- 编辑器工具栏可继续使用
- 用户体验平滑升级，无感知

---

## 9. 技术债务管理

### 9.1 P1阶段无技术债

- 变量解析逻辑统一收敛，无前端渲染闪烁
- 区块骨架采用简单列表，无引导文案残留问题
- Schema预留扩展，无需后续重构
- 正则替换简单高效，无性能瓶颈

### 9.2 P2阶段平滑衔接

- P1骨架结构完全复用，不破坏现有架构
- 渲染函数单一入口，修改成本低
- 前端零改动，测试复用
- config字段启用，用户可自定义样式

---

## 10. 实施计划（下一步）

设计文档已完成，下一步：

1. 提交设计文档到git
2. 用户review设计文档
3. 调用writing-plans skill创建详细实施计划
4. 按计划逐步实现各模块
5. 完成后运行测试验证
6. 提交代码到git

---

**设计文档版本**：v1.0  
**创建日期**：2026-06-28  
**作者**：AI Assistant  
**状态**：待用户review