# P4 多视图渲染引擎实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模板多视图渲染引擎，支持同一周事件素材生成领导版和个人版两种差异化周报输出

**Architecture:** 在TemplateConfig中扩展viewConfigs+sectionTypeMap字段，预设领导版和个人版配置。渲染引擎新增enabledSections参数（基于section标题过滤），API扩展viewType参数，前端增加视图切换按钮和导出对话框。数据库零改动，复用P1预留的config字段。

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, SQLite, React, Tailwind CSS, Milkdown Editor

---

## 文件结构规划

### 新建文件（6个）
- `src/lib/template/view-config.ts` - 视图配置提取函数
- `src/lib/template/view-config.test.ts` - view-config单元测试
- `src/app/api/export/route.ts` - 导出API（支持viewType参数）
- `src/components/ViewSwitcher.tsx` - 视图切换组件
- `src/components/ExportDialog.tsx` - 导出对话框组件
- `src/components/ui/toggle-group.tsx` - ToggleGroup UI组件（shadcn/ui）

### 修改文件（5个）
- `src/lib/db/schema.ts` - 类型扩展（ViewConfig接口、TemplateConfig扩展）
- `src/lib/official-templates.ts` - OfficialTemplate接口扩展config字段 + 预设viewConfigs
- `src/lib/template/render.ts` - 渲染引擎扩展（enabledSections参数、removeSection函数）
- `src/app/api/templates/[id]/render/route.ts` - 模板渲染API扩展（viewType参数）
- `src/app/edit/[id]/page.tsx` - 编辑页面集成视图切换

---

## Phase 1: 数据层与配置

### Task 1: 扩展schema.ts类型定义

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: 新增ViewConfig接口定义**

在 `TemplateConfig` 接口之前新增：

```typescript
export interface ViewConfig {
  enabledSections: string[]
  sectionConfig: Record<string, SectionRenderConfig>
  aiStyle: AIStyle
}
```

- [ ] **Step 2: 扩展TemplateConfig接口（新增viewConfigs和sectionTypeMap字段）**

修改现有 `TemplateConfig` 接口为：

```typescript
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
  sectionTypeMap?: Record<string, SectionType>
  viewConfigs?: {
    leadership?: ViewConfig
    personal?: ViewConfig
  }
}
```

- [ ] **Step 3: 验证类型定义无误**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 4: Commit类型定义扩展**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add ViewConfig interface and extend TemplateConfig for multi-view"
```

---

### Task 2: 修改official-templates.ts添加config字段和viewConfigs

**Files:**
- Modify: `src/lib/official-templates.ts`

- [ ] **Step 1: 扩展OfficialTemplate接口，添加可选config字段**

```typescript
import { TemplateConfig } from '@/lib/db/schema'

export interface OfficialTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  content: string
  config?: TemplateConfig
}
```

需要在文件顶部添加 import。

- [ ] **Step 2: 为official-general模板添加config**

在 `official-general` 模板对象中添加 `config` 字段：

```typescript
config: {
  sectionTypeMap: {
    '本周完成': 'achievement',
    '进行中': 'plan',
    '遇到的问题': 'risk',
    '下周计划': 'plan',
  },
  viewConfigs: {
    leadership: {
      enabledSections: ['本周完成', '下周计划'],
      sectionConfig: {
        '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
        '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
      },
      aiStyle: 'formal'
    },
    personal: {
      enabledSections: ['本周完成', '进行中', '遇到的问题', '下周计划'],
      sectionConfig: {},
      aiStyle: 'detailed'
    }
  }
}
```

- [ ] **Step 3: 为official-tech-dev模板添加config**

```typescript
config: {
  sectionTypeMap: {
    '开发进度': 'achievement',
    'Bug修复': 'risk',
    '运维工作': 'routine',
    '技术沉淀': 'achievement',
    '下周计划': 'plan',
  },
  viewConfigs: {
    leadership: {
      enabledSections: ['开发进度', 'Bug修复', '下周计划'],
      sectionConfig: {
        '开发进度': { maxItems: 3, autoSort: true, filterTrivial: true },
        'Bug修复': { maxItems: 3, autoSort: true, filterTrivial: true },
        '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
      },
      aiStyle: 'formal'
    },
    personal: {
      enabledSections: ['开发进度', 'Bug修复', '运维工作', '技术沉淀', '下周计划'],
      sectionConfig: {},
      aiStyle: 'detailed'
    }
  }
}
```

- [ ] **Step 4: 为official-minimal模板添加config**

```typescript
config: {
  sectionTypeMap: {
    '本周完成': 'achievement',
    '下周重点': 'plan',
  },
  viewConfigs: {
    leadership: {
      enabledSections: ['本周完成', '下周重点'],
      sectionConfig: {
        '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
        '下周重点': { maxItems: 3, autoSort: true, filterTrivial: false },
      },
      aiStyle: 'formal'
    },
    personal: {
      enabledSections: ['本周完成', '下周重点'],
      sectionConfig: {},
      aiStyle: 'detailed'
    }
  }
}
```

- [ ] **Step 5: 为official-personal-review模板添加config**

```typescript
config: {
  sectionTypeMap: {
    '本周成果': 'achievement',
    '踩坑记录': 'risk',
    '技术沉淀': 'achievement',
    '时间复盘': 'routine',
    '下周计划': 'plan',
  },
  viewConfigs: {
    leadership: {
      enabledSections: ['本周成果', '下周计划'],
      sectionConfig: {
        '本周成果': { maxItems: 3, autoSort: true, filterTrivial: true },
        '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
      },
      aiStyle: 'formal'
    },
    personal: {
      enabledSections: ['本周成果', '踩坑记录', '技术沉淀', '时间复盘', '下周计划'],
      sectionConfig: {},
      aiStyle: 'detailed'
    }
  }
}
```

- [ ] **Step 6: 验证模板配置无误**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 7: Commit官方模板配置更新**

```bash
git add src/lib/official-templates.ts
git commit -m "feat: add config with viewConfigs to all official templates"
```

---

### Task 3: 创建view-config.ts视图配置提取函数

**Files:**
- Create: `src/lib/template/view-config.ts`

- [ ] **Step 1: 创建view-config.ts文件**

```typescript
import { TemplateConfig, ViewConfig, SectionType, AIStyle, SectionRenderConfig } from '@/lib/db/schema'

const DEFAULT_LEADERSHIP_CONFIG: ViewConfig = {
  enabledSections: [],
  sectionConfig: {},
  aiStyle: 'formal'
}

const DEFAULT_PERSONAL_CONFIG: ViewConfig = {
  enabledSections: [],
  sectionConfig: {},
  aiStyle: 'detailed'
}

export function extractViewConfig(
  templateConfig: TemplateConfig,
  viewType: 'leadership' | 'personal'
): ViewConfig {
  if (templateConfig.viewConfigs?.[viewType]) {
    return templateConfig.viewConfigs[viewType]
  }

  if (templateConfig.sectionTypeMap) {
    const allSections = Object.keys(templateConfig.sectionTypeMap)
    return {
      enabledSections: allSections,
      sectionConfig: {},
      aiStyle: viewType === 'leadership' ? 'formal' : 'detailed'
    }
  }

  return viewType === 'leadership' ? DEFAULT_LEADERSHIP_CONFIG : DEFAULT_PERSONAL_CONFIG
}

export function resolveSectionType(
  templateConfig: TemplateConfig,
  sectionTitle: string
): SectionType | undefined {
  return templateConfig.sectionTypeMap?.[sectionTitle]
}
```

- [ ] **Step 2: 验证文件创建成功**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 3: Commit view-config.ts**

```bash
git add src/lib/template/view-config.ts
git commit -m "feat: add view config extraction function"
```

---

## Phase 2: 渲染引擎扩展

### Task 4: 扩展render.ts增加enabledSections支持

**Files:**
- Modify: `src/lib/template/render.ts`

- [ ] **Step 1: 扩展RenderOptions接口**

修改现有 `RenderOptions` 接口为：

```typescript
export interface RenderOptions {
  date?: Date;
  events?: RawEvent[];
  sectionConfig?: TemplateConfig['sectionConfig'];
  enabledSections?: string[];
  sectionTypeMap?: Record<string, SectionType>;
}
```

- [ ] **Step 2: 新增removeSection函数**

在 `filterAndFormatEvents` 函数之后添加：

```typescript
function removeSection(content: string, sectionTitle: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let skipping = false

  for (const line of lines) {
    if (line.trim() === `## ${sectionTitle}`) {
      skipping = true
      continue
    }
    if (skipping && line.startsWith('## ')) {
      skipping = false
    }
    if (!skipping) {
      result.push(line)
    }
  }

  return result.join('\n')
}
```

- [ ] **Step 3: 修改renderTemplate函数的section变量替换逻辑**

替换现有的 `SECTION_CONFIG` 和循环逻辑为：

```typescript
  const SECTION_CONFIG: Record<string, SectionType> = {
    核心成果: 'achievement',
    问题与风险: 'risk',
    下周计划: 'plan',
    日常事务: 'routine',
  };

  const sectionMap = options?.sectionTypeMap || SECTION_CONFIG;

  for (const [sectionTitle, sectionType] of Object.entries(sectionMap)) {
    if (options?.enabledSections && !options.enabledSections.includes(sectionTitle)) {
      result = removeSection(result, sectionTitle);
      const placeholderRegex = new RegExp(`\\{\\{${sectionTitle}\\}\\}`, 'g');
      result = result.replace(placeholderRegex, '');
      continue;
    }

    let replacement: string;

    if (options?.events && options.events.length > 0) {
      replacement = filterAndFormatEvents(
        options.events,
        sectionType,
        options.sectionConfig?.[sectionType]
      );
    } else {
      replacement = EMPTY_LIST_ITEMS;
    }

    result = result.replace(
      new RegExp(`\\{\\{${sectionTitle}\\}\\}`, 'g'),
      replacement
    );
  }
```

- [ ] **Step 4: 验证渲染引擎编译无误**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 5: Commit渲染引擎扩展**

```bash
git add src/lib/template/render.ts
git commit -m "feat: extend render engine with enabledSections and sectionTypeMap support"
```

---

### Task 5: 编写render.test.ts扩展测试

**Files:**
- Modify: `src/lib/template/render.test.ts`

- [ ] **Step 1: 在文件末尾添加新的describe块**

```typescript
describe('renderTemplate with enabledSections', () => {
  const createEvent = (
    content: string,
    sectionType: SectionType,
    eventTime: Date
  ): RawEvent => ({
    id: 1,
    eventTime,
    source: 'test',
    content,
    metadata: {},
    category: null,
    sectionType,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should remove disabled sections', () => {
    const content = '## 本周完成\n{{本周完成}}\n## 进行中\n{{进行中}}\n## 下周计划\n{{下周计划}}';
    const sectionTypeMap = {
      '本周完成': 'achievement' as SectionType,
      '进行中': 'plan' as SectionType,
      '下周计划': 'plan' as SectionType,
    };
    const result = renderTemplate(content, {
      enabledSections: ['本周完成', '下周计划'],
      sectionTypeMap,
    });

    expect(result).toContain('## 本周完成');
    expect(result).toContain('## 下周计划');
    expect(result).not.toContain('## 进行中');
    expect(result).not.toContain('{{进行中}}');
  });

  it('should keep all sections when enabledSections includes all', () => {
    const content = '## 本周完成\n{{本周完成}}\n## 下周计划\n{{下周计划}}';
    const sectionTypeMap = {
      '本周完成': 'achievement' as SectionType,
      '下周计划': 'plan' as SectionType,
    };
    const result = renderTemplate(content, {
      enabledSections: ['本周完成', '下周计划'],
      sectionTypeMap,
    });

    expect(result).toContain('## 本周完成');
    expect(result).toContain('## 下周计划');
  });

  it('should apply sectionConfig by SectionType for enabled sections', () => {
    const content = '## 核心成果\n{{核心成果}}';
    const events: RawEvent[] = [
      createEvent('事件1', 'achievement', new Date('2026-07-01')),
      createEvent('事件2', 'achievement', new Date('2026-07-02')),
      createEvent('事件3', 'achievement', new Date('2026-07-03')),
      createEvent('事件4', 'achievement', new Date('2026-07-04')),
    ];

    const result = renderTemplate(content, {
      events,
      sectionConfig: {
        achievement: { maxItems: 3, autoSort: true, filterTrivial: false }
      }
    });

    const lines = result.split('\n').filter(l => l.startsWith('- '));
    expect(lines.length).toBe(3);
  });

  it('should fall back to default SECTION_CONFIG when no sectionTypeMap provided', () => {
    const content = '## 核心成果\n{{核心成果}}\n## 下周计划\n{{下周计划}}';
    const result = renderTemplate(content);

    expect(result).toContain('## 核心成果');
    expect(result).toContain('## 下周计划');
    expect(result).not.toContain('{{核心成果}}');
    expect(result).not.toContain('{{下周计划}}');
  });
});
```

- [ ] **Step 2: 运行测试验证**

运行：`npx vitest run src/lib/template/render.test.ts`
预期：所有测试通过

- [ ] **Step 3: Commit测试扩展**

```bash
git add src/lib/template/render.test.ts
git commit -m "test: add enabledSections unit tests for render engine"
```

---

### Task 6: 编写view-config.test.ts单元测试

**Files:**
- Create: `src/lib/template/view-config.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { extractViewConfig, resolveSectionType } from './view-config'
import { TemplateConfig } from '@/lib/db/schema'

describe('extractViewConfig', () => {
  it('should return leadership config when viewConfigs is present', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成', '下周计划'],
          sectionConfig: {
            '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '进行中', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }

    const config = extractViewConfig(templateConfig, 'leadership')

    expect(config.enabledSections).toEqual(['本周完成', '下周计划'])
    expect(config.aiStyle).toBe('formal')
  })

  it('should return personal config when viewConfigs is present', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成'],
          sectionConfig: {},
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '进行中', '遇到的问题', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }

    const config = extractViewConfig(templateConfig, 'personal')

    expect(config.enabledSections).toContain('进行中')
    expect(config.enabledSections).toContain('遇到的问题')
    expect(config.aiStyle).toBe('detailed')
  })

  it('should fallback to all sections from sectionTypeMap if no viewConfigs', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '下周计划': 'plan',
      }
    }

    const config = extractViewConfig(templateConfig, 'personal')

    expect(config.enabledSections).toEqual(['本周完成', '下周计划'])
    expect(config.aiStyle).toBe('detailed')
  })

  it('should return empty enabledSections for default config without sectionTypeMap', () => {
    const config = extractViewConfig({}, 'leadership')

    expect(config.enabledSections).toEqual([])
    expect(config.aiStyle).toBe('formal')
  })
})

describe('resolveSectionType', () => {
  it('should resolve section type from sectionTypeMap', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '遇到的问题': 'risk',
      }
    }

    expect(resolveSectionType(templateConfig, '本周完成')).toBe('achievement')
    expect(resolveSectionType(templateConfig, '遇到的问题')).toBe('risk')
  })

  it('should return undefined for unknown section title', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: { '本周完成': 'achievement' }
    }

    expect(resolveSectionType(templateConfig, '不存在的section')).toBeUndefined()
  })

  it('should return undefined when no sectionTypeMap', () => {
    expect(resolveSectionType({}, '本周完成')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试验证**

运行：`npx vitest run src/lib/template/view-config.test.ts`
预期：所有测试通过

- [ ] **Step 3: Commit测试**

```bash
git add src/lib/template/view-config.test.ts
git commit -m "test: add unit tests for view config extraction"
```

---

## Phase 3: API扩展

### Task 7: 扩展模板渲染API增加viewType参数

**Files:**
- Modify: `src/app/api/templates/[id]/render/route.ts`

- [ ] **Step 1: 添加导入和viewType参数解析**

在文件顶部添加：
```typescript
import { extractViewConfig } from '@/lib/template/view-config'
import { TemplateConfig } from '@/lib/db/schema'
```

在GET函数中，解析 `viewType` 参数：
```typescript
const viewType = (url.searchParams.get('viewType') as 'leadership' | 'personal') || 'personal'
```

- [ ] **Step 2: 获取模板config并提取视图配置**

修改模板获取逻辑，同时获取 `config`：

```typescript
let templateContent: string
let templateConfig: TemplateConfig = {}

if (templateId.startsWith('official-')) {
  const officialTemplate = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
  if (!officialTemplate) {
    return NextResponse.json({ error: '模板不存在', code: 'NOT_FOUND' }, { status: 404 })
  }
  templateContent = officialTemplate.content
  templateConfig = officialTemplate.config || {}
} else if (templateId.startsWith('user-')) {
  // ... existing user template logic ...
  templateContent = template[0].content
  templateConfig = JSON.parse(template[0].config || '{}')
}

const viewConfig = extractViewConfig(templateConfig, viewType)
```

- [ ] **Step 3: 传递viewConfig参数到renderTemplate**

```typescript
const renderedContent = renderTemplate(templateContent, {
  date: baseDate,
  enabledSections: viewConfig.enabledSections,
  sectionTypeMap: templateConfig.sectionTypeMap,
})
```

- [ ] **Step 4: 在返回JSON中添加viewType和aiStyle**

```typescript
return NextResponse.json({
  content: renderedContent,
  templateId,
  viewType,
  aiStyle: viewConfig.aiStyle,
  baseDate: baseDate.toISOString()
})
```

- [ ] **Step 5: 验证API编译无误**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 6: Commit**

```bash
git add src/app/api/templates/[id]/render/route.ts
git commit -m "feat: extend template render API with viewType parameter"
```

---

### Task 8: 创建导出API

**Files:**
- Create: `src/app/api/export/route.ts`

- [ ] **Step 1: 创建导出API**

```typescript
import { NextResponse } from 'next/server'
import { renderTemplate } from '@/lib/template/render'
import { extractViewConfig } from '@/lib/template/view-config'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import { TemplateConfig } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const { content, templateId, viewType, format = 'markdown' } = await request.json()

    if (!content || !templateId || !viewType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    let templateConfig: TemplateConfig = {}

    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      templateConfig = template?.config || {}
    }

    const viewConfig = extractViewConfig(templateConfig, viewType)

    const exportContent = renderTemplate(content, {
      enabledSections: viewConfig.enabledSections,
      sectionTypeMap: templateConfig.sectionTypeMap,
    })

    return NextResponse.json({
      content: exportContent,
      viewType,
      format,
      aiStyle: viewConfig.aiStyle,
    })
  } catch (error) {
    return NextResponse.json(
      { error: '导出失败', details: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 验证编译**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/app/api/export/route.ts
git commit -m "feat: add export API with viewType support"
```

---

## Phase 4: 前端组件

### Task 9: 创建ToggleGroup UI组件

**Files:**
- Create: `src/components/ui/toggle-group.tsx`

- [ ] **Step 1: 检查是否已有shadcn/ui配置**

运行：`ls src/lib/utils.ts`
预期：文件存在（确认shadcn/ui已配置）

- [ ] **Step 2: 安装依赖**

运行：`npx shadcn@latest add toggle`
预期：安装toggle组件及依赖

- [ ] **Step 3: 创建toggle-group.tsx**

基于shadcn/ui的toggle-group组件模式创建：

```typescript
'use client'

import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { toggleVariants } from '@/components/ui/toggle'

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center gap-1', className)}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      toggleVariants({ variant, size, className }),
      'data-[state=on]:bg-accent data-[state=on]:text-accent-foreground'
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = ToggleGroupItem.displayName

export { ToggleGroup, ToggleGroupItem }
```

注意：如果 `npx shadcn@latest add toggle` 已安装了toggle组件，则直接使用。如果没有toggle组件，则改用简单的Button组实现ViewSwitcher（见Task 10备选方案）。

- [ ] **Step 4: 验证编译**

运行：`npx tsc --noEmit`
预期：无类型错误

---

### Task 10: 创建ViewSwitcher组件

**Files:**
- Create: `src/components/ViewSwitcher.tsx`

- [ ] **Step 1: 创建ViewSwitcher.tsx**

```typescript
'use client'

import { Briefcase, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ViewSwitcherProps {
  currentView: 'leadership' | 'personal'
  onViewChange: (view: 'leadership' | 'personal') => void
  isLoading?: boolean
}

export function ViewSwitcher({ currentView, onViewChange, isLoading }: ViewSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-md border">
        <Button
          type="button"
          variant={currentView === 'leadership' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5 rounded-r-none"
          onClick={() => onViewChange('leadership')}
          disabled={isLoading}
        >
          <Briefcase className="h-3.5 w-3.5" />
          领导版
        </Button>
        <Button
          type="button"
          variant={currentView === 'personal' ? 'default' : 'ghost'}
          size="sm"
          className="gap-1.5 rounded-l-none"
          onClick={() => onViewChange('personal')}
          disabled={isLoading}
        >
          <User className="h-3.5 w-3.5" />
          个人版
        </Button>
      </div>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewSwitcher.tsx
git commit -m "feat: add ViewSwitcher component for multi-view toggle"
```

---

### Task 11: 创建ExportDialog组件

**Files:**
- Create: `src/components/ExportDialog.tsx`

- [ ] **Step 1: 创建ExportDialog.tsx**

```typescript
'use client'

import { useState } from 'react'
import { Download, Briefcase, User, FileText } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ExportDialogProps {
  content: string
  templateId: string
}

export function ExportDialog({ content, templateId }: ExportDialogProps) {
  const [selectedView, setSelectedView] = useState<'leadership' | 'personal'>('personal')
  const [isExporting, setIsExporting] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleExport() {
    setIsExporting(true)

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          templateId,
          viewType: selectedView,
          format: 'markdown',
        })
      })

      if (!response.ok) {
        throw new Error('导出失败')
      }

      const data = await response.json()

      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `周报-${selectedView === 'leadership' ? '领导版' : '个人版'}.md`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('导出成功')
      setOpen(false)
    } catch (error) {
      toast.error('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出周报
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>导出周报</DialogTitle>
        <DialogDescription>
          选择导出视图，生成差异化周报文件
        </DialogDescription>
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label className="text-base">导出视图</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  selectedView === 'leadership'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setSelectedView('leadership')}
              >
                <Briefcase className="h-5 w-5" />
                <span className="text-sm font-medium">领导版</span>
                <span className="text-xs text-muted-foreground">精炼汇报</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  selectedView === 'personal'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setSelectedView('personal')}
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">个人版</span>
                <span className="text-xs text-muted-foreground">完整复盘</span>
              </button>
            </div>
          </div>

          <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
            <FileText className="h-4 w-4" />
            {isExporting ? '导出中...' : '确认导出 Markdown'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 验证编译**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportDialog.tsx
git commit -m "feat: add ExportDialog component with view selection"
```

---

### Task 12: 集成视图切换到编辑页面

**Files:**
- Modify: `src/app/edit/[id]/page.tsx`

- [ ] **Step 1: 添加导入**

```typescript
import { ViewSwitcher } from '@/components/ViewSwitcher'
import { ExportDialog } from '@/components/ExportDialog'
```

- [ ] **Step 2: 添加状态变量**

在现有状态定义区域添加：

```typescript
const [currentView, setCurrentView] = useState<'leadership' | 'personal'>('personal')
const [viewLoading, setViewLoading] = useState(false)
const [templateId, setTemplateId] = useState<string>('official-general')
const [baseContent, setBaseContent] = useState('')
```

- [ ] **Step 3: 在fetchReport中保存baseContent和templateId**

在 `fetchReport` 函数中，获取到report后添加：

```typescript
setBaseContent(report.content)
```

注意：Report目前没有templateId字段，所以templateId保持默认值。后续可以通过API扩展获取。

- [ ] **Step 4: 添加handleViewChange函数**

```typescript
async function handleViewChange(view: 'leadership' | 'personal') {
  if (view === currentView) return

  setViewLoading(true)

  try {
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: baseContent,
        templateId,
        viewType: view,
      })
    })

    if (!response.ok) {
      throw new Error('视图渲染失败')
    }

    const data = await response.json()
    setContent(data.content)
    setCurrentView(view)
    setEditorKey(k => k + 1)

    toast.success(`已切换到${view === 'leadership' ? '领导版' : '个人版'}视图`)
  } catch (error) {
    toast.error('视图切换失败，请重试')
  } finally {
    setViewLoading(false)
  }
}
```

- [ ] **Step 5: 在页面头部工具栏添加ViewSwitcher和ExportDialog**

在 `<h1>` 标签后面添加：

```typescript
<div className="flex items-center gap-4 ml-4">
  <ViewSwitcher
    currentView={currentView}
    onViewChange={handleViewChange}
    isLoading={viewLoading}
  />
</div>
```

在底部按钮区域（保存按钮旁）添加：

```typescript
<ExportDialog content={baseContent} templateId={templateId} />
```

- [ ] **Step 6: 验证编译**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 7: Commit**

```bash
git add src/app/edit/[id]/page.tsx
git commit -m "feat: integrate ViewSwitcher and ExportDialog into edit page"
```

---

## Phase 5: 验证

### Task 13: 全量验证

- [ ] **Step 1: TypeScript编译检查**

运行：`npx tsc --noEmit`
预期：无类型错误

- [ ] **Step 2: 运行全量测试**

运行：`npx vitest run`
预期：所有测试通过

- [ ] **Step 3: Lint检查**

运行：`npm run lint`（如有配置）
预期：无lint错误

- [ ] **Step 4: 手动验证视图切换**

1. `npm run dev`
2. 打开编辑页面
3. 点击"领导版"按钮 → 验证编辑器内容只包含精简section
4. 点击"个人版"按钮 → 验证编辑器内容包含全部section
5. 点击"导出周报" → 选择视图 → 验证下载文件内容正确

---

## 自检清单

### Spec覆盖率检查

- Task 1-3: 数据层扩展（ViewConfig接口、TemplateConfig扩展、官方模板预设、view-config函数）
- Task 4-6: 渲染引擎扩展（enabledSections参数、removeSection函数、单元测试）
- Task 7-8: API扩展（模板渲染API增加viewType、导出API）
- Task 9-12: 前端组件（ViewSwitcher、ExportDialog、编辑页面集成）
- Task 13: 全量验证

### 设计决策说明

1. **ViewConfig使用section标题（string）而非SectionType**：因为不同模板的section标题不同，无法统一映射到SectionType。使用标题作为key更灵活。
2. **sectionTypeMap用于标题到SectionType的映射**：每个模板可自定义自己的映射关系。
3. **ExportDialog接收content+templateId而非reportId**：因为Report schema没有templateId字段，避免数据库改动。
4. **ViewSwitcher使用Button组而非ToggleGroup**：减少额外依赖，UI效果一致。

---

**计划文档版本**: v2.0
**创建日期**: 2026-07-05
**最后修改**: 2026-07-05（修正codebase不一致问题）
**状态**: 执行中
