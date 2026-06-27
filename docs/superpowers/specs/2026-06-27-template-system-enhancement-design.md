# 模板系统增强设计文档

## 项目概述

优化现有模板系统，引入官方标准模板体系，支持模板分类、简介、标签等功能，保证完全向下兼容现有模板数据。

## 核心需求

1. 系统内置4套官方标准周报模板（用户可直接使用、另存为个人模板）
2. 模板新增字段：类型(official/user)、简介、标签
3. 前端模板列表区分「官方模板 / 个人模板」
4. 新建周报时默认可以选择模板、一键带入骨架
5. 所有模板兼容现有 Milkdown Markdown 编辑器
6. 官方模板统一更新，用户另存后的个人模板独立维护

## 设计决策

### 关键决策记录

| 决策点                       | 选择方案                       | 原因                                      |
| ---------------------------- | ------------------------------ | ----------------------------------------- |
| 现有默认模板处理             | 删除并替换                     | 用新的官方模板体系替代单一默认模板        |
| 另存为交互方式               | 支持两种方式                   | 提供快速克隆和预编辑两种灵活性            |
| 官方模板更新策略             | 统一更新                       | 改配置文件即生效，无需migration           |
| 存储架构                     | 分离存储方案（推荐）           | 官方模板存配置，用户模板存数据库，概念清晰 |

## 技术栈

| 技术         | 用途             |
| ------------ | ---------------- |
| Next.js 16   | 框架 (App Router) |
| Drizzle ORM  | 数据库 ORM       |
| SQLite       | 数据库           |
| Milkdown     | Markdown 编辑器  |
| shadcn/ui    | UI 组件库        |
| Tailwind CSS | 样式框架         |

## 数据模型设计

### 官方模板配置文件

```typescript
// src/lib/official-templates.ts
export interface OfficialTemplate {
  id: string                    // 固定字符串ID，如 'official-general'
  name: string                  // 模板名称
  description: string           // 简介
  tags: string[]                // 标签数组
  content: string               // Markdown内容
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

##踩坑记录
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

### 用户模板Schema

```typescript
// src/lib/db/schema.ts
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  content: text('content').notNull(),
  description: text('description'),            // 新增：简介
  tags: text('tags'),                           // 新增：标签（逗号分隔存储）
  sourceTemplateId: text('source_template_id'), // 新增：来源官方模板ID（用于追溯另存为来源）
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
```

**关键变更：**
- 删除 `isDefault` 字段（官方模板不再存数据库）
- 删除 `workTypes` 字段（改用更灵活的 `tags`）
- 新增 `description` 字段记录模板简介
- 新增 `tags` 字段存储标签（逗号分隔）
- 新增 `sourceTemplateId` 记录另存为来源

## API 设计

### 模板列表API

```typescript
// GET /api/templates
// 响应格式
{
  official: OfficialTemplate[],  // 来自配置文件
  user: Template[]               // 来自数据库
}
```

### 新增克隆API

```typescript
// POST /api/templates/clone
// 请求体
{
  sourceId: string,    // 源模板ID（统一字符串格式）
  name?: string,       // 可选：自定义名称
  content?: string     // 可选：预编辑后的内容
}

// 响应
{
  template: Template,  // 新创建的用户模板
  message: "模板已克隆成功"
}
```

**ID格式规范：**
- 官方模板ID：`'official-general'` 等字符串
- 用户模板ID：`'user-1'` 等（字符串前缀 + 数字ID）
- 所有ID统一使用字符串格式，避免类型冲突

**克隆逻辑：**
1. 根据 `sourceId` 前缀判断来源类型
   - `official-` 前缀：从配置文件获取源模板
   - `user-` 前缀：去掉前缀，从数据库获取源模板（数字ID）
2. 复制源模板内容，应用用户自定义修改
3. 写入用户模板表，记录 `sourceTemplateId`
4. 返回新模板ID，前端跳转编辑页

### 现有API调整

```typescript
// GET /api/templates/[id] - 只查询用户模板
// POST /api/templates - 只创建用户模板
// PUT /api/templates/[id] - 只更新用户模板
// DELETE /api/templates/[id] - 只删除用户模板
```

**调整说明：**
- 所有现有CRUD API只处理用户模板（数据库存储）
- 官方模板通过配置文件管理，不提供修改API
- 用户克隆后自动转为用户模板，可正常编辑删除

## 前端组件设计

### 模板列表页架构

```
┌─────────────────────────────────────────┐
│  模板管理                                │
├─────────────────────────────────────────┤
│  [官方模板] [个人模板]  ← Tab切换         │
├─────────────────────────────────────────┤
│  官方模板Tab内容：                        │
│  ┌───────────────────────────────────┐  │
│  │ 通用正式周报模板                    │  │
│  │ 适合大多数工作场景的3+1结构         │  │
│  │ 标签: 通用, 正式                    │  │
│  │ [快速克隆] [另存为]                 │  │
│  └───────────────────────────────────┘  │
│  ...（其他3个官方模板卡片）              │
├─────────────────────────────────────────┤
│  个人模板Tab内容：                        │
│  ┌───────────────────────────────────┐  │
│  │ 我的开发周报                        │  │
│  │ 来源: 技术研发专属模板              │  │
│  │ 标签: 开发, 技术                    │  │
│  │ [使用] [编辑] [删除]                │  │
│  └───────────────────────────────────┐  │
│  [+ 新建个人模板]                        │
└─────────────────────────────────────────┘
```

### 新建周报页模板选择

**使用shadcn Select组件实现分组选择：**

```typescript
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'

<Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
  <SelectTrigger>
    <SelectValue placeholder="选择模板" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>官方模板</SelectLabel>
      {officialTemplates.map(t => (
        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
      ))}
    </SelectGroup>
    <SelectGroup>
      <SelectLabel>个人模板</SelectLabel>
      {userTemplates.map(t => (
        <SelectItem key={t.id} value={`user-${t.id}`}>{t.name}</SelectItem>
      ))}
    </SelectGroup>
  </SelectContent>
</Select>
```

**ID标识策略：**
- 官方模板ID：`'official-general'` 等（字符串）
- 用户模板ID：`'user-1'` 等（字符串前缀 + 数字ID）
- 避免类型冲突，统一使用字符串ID

### 组件拆分方案

**核心组件列表：**

| 组件名                | 功能                           | 状态管理 |
| --------------------- | ------------------------------ | -------- |
| TemplateTabs          | 官方/个人模板Tab切换容器       | 本地state |
| OfficialTemplateCard  | 官方模板卡片展示 + 操作按钮    | 无状态   |
| UserTemplateCard      | 用户模板卡片 + 编辑/删除按钮   | 无状态   |
| TemplateSelect        | shadcn Select封装 + 选择逻辑   | 本地state |
| CloneTemplateDialog   | 另存为对话框 + 表单验证        | 本地state |
| TemplateForm          | 模板编辑表单（复用现有组件）   | 本地state |

**另存为交互流程：**

**快速克隆：**
```
点击"快速克隆" → POST /api/templates/clone 
  { sourceId: 'official-general' }
→ 服务端复制内容 → 写入 templates 表
→ 返回新模板ID → 跳转 /templates/[id] 编辑页
```

**预编辑保存：**
```
点击"另存为" → 打开CloneTemplateDialog
  - 显示源模板内容（Milkdown编辑器）
  - 用户可修改名称、内容
→ 点击保存 → POST /api/templates/clone
  { sourceId: 'official-general', name: '自定义名', content: '修改后内容' }
→ 保存并跳转编辑页
```

## 数据流与状态管理

### 初始化流程

```
应用启动 → 检查数据库版本 → 
  - 存在旧schema → 执行migration（删除旧默认模板，重建表）
  - 不存在 → 创建新schema
→ 应用就绪
```

### 模板列表加载流程

```
页面加载 → GET /api/templates → 
  服务端读取 official-templates.ts（官方模板）
  服务端查询 templates 表（用户模板）
  → 合并返回 { official: [], user: [] }
  → 前端缓存到 state
  → TemplateTabs渲染分组列表
```

### 新建周报模板选择流程

```
选择模板 → 根据ID前缀判断类型
  - 'official-*' → 从前端state.official获取content
  - 'user-*' → 从前端state.user获取content（去掉前缀）
→ 设置Milkdown编辑器内容
→ setEditorKey(k => k + 1) 触发编辑器重建
```

## 错误处理

### API错误场景

| 场景                             | HTTP状态码 | 错误响应                                        | 处理方式                     |
| -------------------------------- | ---------- | ----------------------------------------------- | ---------------------------- |
| 克隆源模板不存在                 | 400        | `{ error: "模板不存在", code: "TEMPLATE_NOT_FOUND" }` | 显示toast提示                |
| 用户模板不存在（GET/PUT/DELETE） | 404        | `{ error: "模板不存在", code: "TEMPLATE_NOT_FOUND" }` | 跳转模板列表页并提示         |
| 数据验证失败                     | 400        | `{ error: "字段验证失败", details: {...} }`     | 显示具体字段错误             |
| 数据库连接失败                   | 500        | `{ error: "系统错误，请稍后重试" }`             | 显示toast提示，记录日志      |
| 模板ID冲突                       | 400        | `{ error: "模板ID格式非法" }`                   | 阻止创建，提示错误           |

### 前端错误处理

- 使用 `toast.error()` 显示错误提示
- CloneTemplateDialog 中验证必填字段（名称不能为空）
- 保存失败时保留编辑内容，不关闭对话框
- 模板列表加载失败显示空状态，不影响其他功能

### 特殊场景处理

| 场景                           | 处理方式                                     |
| ------------------------------ | -------------------------------------------- |
| 官方模板配置文件加载失败       | 服务端日志记录，返回空官方列表，前端显示提示 |
| 模板内容包含非法字符           | API层验证，拦截并返回错误                    |
| 另存为名称重复                 | 允许重复名称，不强制唯一                     |

## 测试策略

### 前端组件单元测试

**测试工具：** Vitest + React Testing Library

**组件拆分原则：**
- 每个组件职责单一，便于独立测试
- 无状态组件优先，业务逻辑提升到容器组件
- 事件回调通过props传递，便于mock验证

**测试覆盖表：**

| 组件                 | 测试点                                            | 测试数量 |
| -------------------- | ------------------------------------------------- | -------- |
| OfficialTemplateCard | 渲染名称、描述、标签；按钮点击触发正确回调        | 5个      |
| UserTemplateCard     | 渲染模板信息；来源标识显示；编辑/删除按钮触发回调 | 6个      |
| TemplateSelect       | 分组渲染正确；选择官方/用户模板触发onChange       | 4个      |
| CloneTemplateDialog  | 验证必填字段；显示源模板内容；保存按钮触发提交    | 7个      |
| TemplateTabs         | Tab切换正确；空状态显示；加载状态显示             | 5个      |

**测试示例：**

```typescript
// OfficialTemplateCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { OfficialTemplateCard } from '@/components/OfficialTemplateCard'

const mockTemplate = {
  id: 'official-general',
  name: '通用正式周报模板',
  description: '适合大多数工作场景的3+1结构周报',
  tags: ['通用', '正式'],
  content: '...'
}

test('renders official template with action buttons', () => {
  const onClone = jest.fn()
  const onSaveAs = jest.fn()
  
  render(<OfficialTemplateCard 
    template={mockTemplate}
    onClone={onClone}
    onSaveAs={onSaveAs}
  />)
  
  expect(screen.getByText('通用正式周报模板')).toBeInTheDocument()
  expect(screen.getByText('适合大多数工作场景的3+1结构周报')).toBeInTheDocument()
  expect(screen.getByText('标签: 通用, 正式')).toBeInTheDocument()
  
  fireEvent.click(screen.getByText('快速克隆'))
  expect(onClone).toHaveBeenCalledWith('official-general')
  
  fireEvent.click(screen.getByText('另存为'))
  expect(onSaveAs).toHaveBeenCalledWith('official-general')
})

// TemplateSelect.test.tsx
test('selects official template correctly', () => {
  const onChange = jest.fn()
  const officialTemplates = [mockTemplate]
  const userTemplates = []
  
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
```

### 后端API测试

**测试工具：** Vitest

**测试覆盖：**
- 模板列表合并逻辑（官方+用户）
- 克隆API：源ID解析、内容复制、字段写入
- 用户模板CRUD操作
- 数据验证逻辑
- 错误处理场景

**测试示例：**

```typescript
// api/templates.test.ts
test('returns merged template list', async () => {
  // Mock数据库查询返回用户模板
  const userTemplates = [{ id: 1, name: 'My Template', ... }]
  
  const response = await GET()
  const data = await response.json()
  
  expect(data.official).toHaveLength(4)  // 4个官方模板
  expect(data.user).toHaveLength(1)
  expect(data.official[0].id).toBe('official-general')
})

test('clones official template to user template', async () => {
  const request = {
    sourceId: 'official-general',
    name: 'My Custom Template'
  }
  
  const response = await POST_CLONE(request)
  const data = await response.json()
  
  expect(data.template.name).toBe('My Custom Template')
  expect(data.template.sourceTemplateId).toBe('official-general')
  expect(data.template.id).toBeDefined()
})
```

### 集成测试

**测试工具：** Playwright

**测试场景：**
- 模板列表加载流程：验证官方/用户模板分组显示
- 另存为完整流程：点击 → 编辑 → 保存 → 跳转
- 新建周报模板选择：选择模板 → 编辑器内容切换
- 向下兼容验证：升级后旧用户模板完整保留

## 向下兼容处理

### 数据库迁移策略

**Migration文件：** `0003_enhance_templates.sql`

```sql
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

-- Step 4: 验证迁移
SELECT COUNT(*) FROM templates;  -- 应等于旧用户模板数量
```

### 兼容性保证

| 场景                 | 保证措施                                     |
| -------------------- | -------------------------------------------- |
| 用户个人模板数据     | 完整保留，只迁移字段结构                     |
| 旧默认模板           | 删除（用官方模板体系替代）                   |
| API响应格式变化      | 前端适配新 `{ official, user }` 结构        |
| 模板选择逻辑         | ID标识策略变更，需前端调整                   |

### 迁移执行时机

- 应用启动时通过 `drizzle-orm` 自动检查数据库版本
- 执行migration脚本，无需用户手动操作
- 迁移失败时记录日志，提示用户检查数据库状态

## 部署与更新策略

### 官方模板更新机制

**更新流程：**
```
修改 official-templates.ts → 提交代码 → 部署 → 
应用重启 → 自动加载新官方模板 → 用户立即看到更新
```

**关键点：**
- 官方模板存代码配置，不存数据库
- 更新无需执行migration，只需重新部署
- 用户另存后的个人模板不受影响，独立维护

### 版本控制建议

- `official-templates.ts` 放在 `src/lib/` 目录，纳入git管理
- 模板内容变更通过git提交记录追踪
- 建议在配置中添加 `version` 字段记录模板版本号（可选）

## 非功能性需求

### 性能考虑

| 场景               | 性能指标              | 实现方式                     |
| ------------------ | --------------------- | ---------------------------- |
| 模板列表加载       | < 100ms               | 配置文件读取 + 数据库查询    |
| 模板克隆           | < 50ms                | 单次数据库写入               |
| 模板选择切换       | < 10ms                | 前端state读取                |

### 安全考虑

- 模板内容验证：防止非法字符注入
- ID格式验证：阻止用户创建 `official-` 前缀模板
- 数据库操作使用Drizzle ORM，防止SQL注入

### 可维护性

- 官方模板集中管理在单一配置文件
- 前端组件职责单一，易于扩展
- API设计符合RESTful规范
- 数据库schema使用Drizzle ORM管理

## 后续扩展建议

### 可选扩展功能（不在P0阶段）

- 模板版本管理（用户可回溯历史版本）
- 模板分享功能（导出/导入JSON格式）
- 模板使用统计（记录最常用模板）
- 模板标签智能推荐
- 自动从事件表生成周报骨架（基于模板）

### 架构演进方向

- 官方模板可扩展为"模板商店"（支持第三方模板）
- 用户模板可支持协作编辑（多用户共享）
- 模板可绑定自动事件归集规则

## 总结

本设计采用分离存储架构，将官方模板存配置文件、用户模板存数据库，实现：
- 官方模板统一更新，无需migration
- 用户另存后的模板独立维护
- 完全向下兼容现有用户模板数据
- 前端组件清晰分层，易于测试和维护
- API设计符合现有架构规范

设计满足P0阶段所有需求，为后续扩展预留架构空间。