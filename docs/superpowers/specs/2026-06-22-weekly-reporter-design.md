# 周报编辑器设计文档

## 项目概述

个人使用的周报编辑器，使用 Markdown 编写，SQLite 存储，提供所见即所得的编辑体验。

## 技术栈

| 技术            | 用途                |
| --------------- | ------------------- |
| Next.js 14+     | 框架 (App Router)   |
| Drizzle ORM     | 数据库 ORM          |
| better-sqlite3  | SQLite 驱动         |
| Milkdown        | 所见即所得编辑器    |
| shadcn/ui       | UI 组件库           |
| Tailwind CSS    | 样式框架            |

## 项目结构

```
weekly-reporter/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # 首页 - 周报列表
│   │   ├── edit/[id]/page.tsx # 编辑页
│   │   ├── new/page.tsx       # 新建页
│   │   └── api/               # API 路由
│   │       └── reports/
│   ├── components/            # UI 组件
│   │   ├── ui/               # shadcn 组件
│   │   └── editor/           # 编辑器组件
│   ├── lib/
│   │   ├── db/               # 数据库配置
│   │   │   ├── schema.ts     # Drizzle schema
│   │   │   └── index.ts      # 数据库连接
│   │   ├── paths.ts          # XDG 路径解析
│   │   └── utils.ts
│   └── types/
├── drizzle.config.ts
└── package.json
```

## XDG 数据存储规范

数据文件存储位置：
- 数据库文件：`~/.local/share/weekly-reporter/reports.db`
- 配置文件：`~/.config/weekly-reporter/config.json`

路径解析实现：
```typescript
// src/lib/paths.ts
import path from 'path'
import os from 'os'

const XDG_DATA_HOME = process.env.XDG_DATA_HOME || 
  path.join(os.homedir(), '.local', 'share')
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || 
  path.join(os.homedir(), '.config')

export const DATA_DIR = path.join(XDG_DATA_HOME, 'weekly-reporter')
export const CONFIG_DIR = path.join(XDG_CONFIG_HOME, 'weekly-reporter')
export const DB_PATH = path.join(DATA_DIR, 'reports.db')
```

## 数据模型

```typescript
// src/lib/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),           // 周报标题
  content: text('content').notNull(),        // Markdown 内容
  weekStart: text('week_start').notNull(),  // 周起始日期 (YYYY-MM-DD)
  weekEnd: text('week_end').notNull(),      // 周结束日期 (YYYY-MM-DD)
  createdAt: integer('created_at').notNull(), // 创建时间戳
  updatedAt: integer('updated_at').notNull(), // 更新时间戳
})

export type Report = typeof reports.$inferSelect
export type NewReport = typeof reports.$inferInsert
```

字段说明：
- `title`：周报标题，如"2024年第1周工作周报"
- `content`：Markdown 格式的周报内容
- `weekStart/weekEnd`：该周报对应的日期范围，便于按周筛选
- 时间戳用 `integer` 存储 Unix 时间戳

## API 设计

### 接口列表

```
GET    /api/reports           # 获取周报列表（支持分页、排序）
GET    /api/reports/[id]      # 获取单篇周报
POST   /api/reports           # 创建周报
PUT    /api/reports/[id]      # 更新周报
DELETE /api/reports/[id]      # 删除周报
GET    /api/reports/search    # 搜索周报（按标题、内容、日期范围）
```

### 响应格式

```typescript
// GET /api/reports
{
  reports: Report[],
  total: number,
  page: number,
  pageSize: number
}

// POST /api/reports
{
  title: string,
  content: string,
  weekStart: string,
  weekEnd: string
}
```

## 编辑器方案

使用 **Milkdown** 作为所见即所得 Markdown 编辑器。

选择理由：
- 所见即所得，类似 Typora 体验
- 基于 ProseMirror，稳定可靠
- 插件丰富：表格、代码高亮、数学公式、图片上传
- 支持主题定制
- 良好的 TypeScript 支持

编辑器功能：
- 标题、加粗、斜体、删除线
- 有序/无序列表
- 代码块（带语法高亮）
- 表格
- 链接、图片
- 快捷键支持（Ctrl+B 加粗等）

组件结构：
```typescript
// src/components/editor/MilkdownEditor.tsx
// 包装 Milkdown，提供 value/onChange 接口
```

## UI 组件与页面设计

### UI 框架

shadcn/ui + Tailwind CSS

### 页面结构

#### 首页（周报列表）

```
┌─────────────────────────────────────┐
│  周报编辑器              [+ 新建周报] │
├─────────────────────────────────────┤
│  🔍 搜索...                          │
├─────────────────────────────────────┤
│  2024年第1周 (01/01 - 01/07)    📝 🗑 │
│  创建于 2024-01-05                   │
├─────────────────────────────────────┤
│  2023年第52周 (12/25 - 12/31)  📝 🗑 │
│  创建于 2023-12-29                   │
└─────────────────────────────────────┘
```

#### 编辑页

```
┌─────────────────────────────────────┐
│  ← 返回    2024年第1周      [保存]   │
├─────────────────────────────────────┤
│  标题: [____________________]        │
│  日期: [01/01] - [01/07]             │
├─────────────────────────────────────┤
│                                      │
│     Milkdown 所见即所得编辑器         │
│                                      │
└─────────────────────────────────────┘
```

### 组件清单

- `ReportList` - 周报列表
- `ReportCard` - 周报卡片
- `SearchBar` - 搜索栏
- `Editor` - 编辑器包装
- `DatePicker` - 日期选择器

## 数据流与状态管理

### 数据流

```
用户操作 → API 请求 → Server Action/Route Handler → Drizzle → SQLite
                ↓
           状态更新 → UI 刷新
```

### 状态管理

- 使用 React Server Components 获取数据（列表页）
- 使用 Server Actions 处理表单提交（创建/更新/删除）
- 编辑页使用客户端状态（编辑器内容）
- 使用 `react-hook-form` 处理表单

### 数据同步

- 保存后使用 `revalidatePath` 刷新缓存
- 支持乐观更新（删除时）

## 错误处理

### API 错误处理

- 统一错误响应格式：`{ error: string, code: string }`
- 使用 Zod 验证输入数据
- 捕获数据库错误，返回友好提示

### 常见错误场景

| 场景           | 处理方式                   |
| -------------- | -------------------------- |
| 周报不存在     | 404，跳转首页并提示        |
| 数据验证失败   | 显示具体字段错误           |
| 数据库连接失败 | 显示"系统错误，请稍后重试" |
| 保存失败       | 保留编辑内容，显示错误提示 |

### UI 错误展示

- 使用 Toast 通知（shadcn/ui 的 toast）
- 表单字段下方显示验证错误

## 测试策略

### 单元测试

- 数据库操作测试
- API 路由测试
- 使用 Vitest

### 集成测试

- 表单提交流程
- 使用 Playwright

### 测试覆盖重点

- 周报 CRUD 操作
- 数据验证逻辑
- 搜索功能

## 后续扩展

可选的后续功能：
- 导出为 PDF/Word
- 周报模板管理
- 多设备同步（可选）
- 标签分类