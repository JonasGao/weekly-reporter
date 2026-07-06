# Memo 随手记模块设计文档

## 一、核心定位与设计理念

### 1.1 模块定位
Memo 模块是"低摩擦工作记忆沉淀"的核心底座，作为 Git 自动采集的补充，完善记忆沉淀层的核心能力。

**核心目标**：
- 解决"记不住做了什么"的本质问题
- 提供低摩擦的手动记录入口，补充非代码类工作成果
- 与 Git 采集内容统一管理，形成完整的工作记忆轨迹

**应用场景**：
- 工作中随手记录（临时想法、小任务、会议要点）
- 补充 Git 采集遗漏（文档编写、沟通协调、规划思考）
- 工作日记/日志（结构化记录每日工作内容）

### 1.2 设计原则
1. **最小化落地**：复用现有 `raw_events` 表，新增必要字段，避免架构冗余
2. **单一数据源**：所有记录统一存储在 `raw_events` 表，周报生成无需额外合并逻辑
3. **体验极简**：单行输入框 + 回车保存，零额外操作，降低记录摩擦
4. **灵活分类**：#标签语法 + 可配置映射规则，兼顾自由度与标准化
5. **架构预留**：关键扩展位提前预埋，当前阶段不做冗余开发

## 二、数据模型设计

### 2.1 新增 tags 表
```typescript
tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),           // 标签名称，如 "工作"、"会议"
  sectionType: text('section_type').$type<SectionType>(),  // 映射到周报分类
  color: text('color'),                            // 可选，标签显示颜色
  isBuiltIn: integer('is_built_in', { mode: 'boolean' }).default(false),  // 是否为官方内置
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
```

**字段说明**：
- `name`：标签唯一标识，用于 #标签语法解析
- `sectionType`：映射到周报的区块类型（achievement/risk/routine/plan）
- `color`：可选字段，用于时间线上标签的视觉区分
- `isBuiltIn`：标记官方预设标签，用户不可删除

### 2.2 扩展 raw_events 表字段
```typescript
rawEvents 新增字段：
- tags: text('tags', { mode: 'json' }).$type<string[]>()  // 存储标签列表，如 ["工作", "会议"]
- isImportant: integer('is_important', { mode: 'boolean' }).default(false)  // 是否标记为重要
- source 扩展值：新增 'manual' 标记手动 Memo 记录
```

**设计理由**：
- 完全复用现有表结构，最小化改动范围
- `tags` 字段存储解析后的标签列表，支持多标签标记
- `isImportant` 字段支持重要记录的高亮展示和优先排序
- `source='manual'` 区分手动记录与 Git 采集，便于后续扩展

### 2.3 标签映射逻辑
**周报生成时的分类规则**：
1. 解析记录的 `tags` 字段，获取标签列表
2. 查询 `tags` 表，获取每个标签的 `sectionType` 映射
3. 多标签冲突时，按优先级确定最终分类：`achievement > risk > plan > routine`
4. 未配置映射的标签，默认归入 `routine`
5. 无标签的记录（Git 采集），保持现有手动分类流程

## 三、页面路由与导航结构

### 3.1 新路由规划
```
/ (首页) → 时间线页面（工作记录）
/reports → 周报列表页面（二级页面）
/reports/new → 新建周报（保持不变）
/reports/[id] → 编辑周报（保持不变）
/tags → 标签管理页面（新增）
/templates → 模板管理页面（保持不变）
/collect → 采集源管理页面（保持不变）
```

**路由调整**：
- 当前 `/` 路由（周报列表）移动到 `/reports`
- 新 `/` 路由渲染时间线页面
- 保持现有页面逻辑不变，仅调整路由位置

### 3.2 导航组件设计
**顶部导航栏**：
```
[ 时间线 ] [ 周报 ] [ 标签 ] [ 模板 ] [ 采集源 ]
```

**首页（时间线）布局**：
```
┌─────────────────────────────────────────┐
│ [ 记录工作内容，使用 #标签 分类... ]     │ ← QuickInputBar
├───────────────────────┬─────────────────┤
│                       │                 │
│   TimelineView        │  TagFilterPanel │
│   (时间线主体)         │  (右侧筛选)     │
│                       │                 │
│                       │                 │
└───────────────────────┴─────────────────┘
```

## 四、时间线组件设计

### 4.1 核心组件结构
```
TimelinePage
├─ QuickInputBar (顶部单行输入框)
├─ TimelineView (左侧时间线主体)
│  ├─ ViewSwitcher (日/周/月切换器)
│  ├─ TimelineGroup (聚合组容器)
│  │  ├─ EventCard (单条记录卡片)
│  │  │  ├─ 内容展示（Markdown 渲染）
│  │  │  ├─ 标签展示（彩色标签徽章）
│  │  │  ├─ 时间展示（相对时间，如"2小时前"）
│  │  │  ├─ 来源图标（Git/Memo 区分）
│  │  │  ├─ 重要标记（左侧黄色圆点）
│  │  │  ├─ 操作按钮（编辑/删除/标记重要）
│  │  │  └─ InlineEditForm (内联编辑表单)
├─ TagFilterPanel (右侧标签筛选面板)
```

### 4.2 时间线聚合逻辑
**按日聚合**：
- 每天一个 `TimelineGroup`，标题显示日期（如 "2024-01-15 星期一"）
- 组内记录按 `eventTime` 倒序排列
- 默认视图模式

**按周聚合**：
- 每周一个 `TimelineGroup`，标题显示周范围（如 "2024-W2 (01-08 ~ 01-14)"）
- 组内记录按 `eventTime` 倒序排列
- 方便查看本周素材，对接周报生成周期

**按月聚合**：
- 每月一个 `TimelineGroup`，标题显示月份（如 "2024年01月"）
- 组内记录按 `eventTime` 倒序排列
- 方便长期回顾和月度复盘

### 4.3 EventCard 交互设计
**默认态**：
- 内容展示：Markdown 渲染，支持简单格式
- 标签展示：彩色徽章，点击触发筛选
- 时间展示：相对时间（2小时前） + 绝对时间（hover 显示）
- 来源图标：Git（代码图标） vs Memo（笔记图标）
- 重要标记：左侧黄色圆点 + 顶部固定排序

**内联编辑态**（点击编辑按钮后展开）：
- 内容编辑：文本输入框
- 时间调整：日期时间选择器
- 标签管理：标签选择器 + 新增标签输入
- 重要标记：勾选框
- 保存/取消按钮

**删除操作**：
- 删除按钮触发确认对话框
- 确认后删除记录，刷新时间线
- Git 采集记录不可删除（仅 Memo 记录可删）

### 4.4 数据查询与性能优化
**查询逻辑**：
```typescript
// 按聚合级别查询
async function getTimelineEvents(viewMode: 'day' | 'week' | 'month') {
  const events = await db.select()
    .from(rawEvents)
    .orderBy(desc(rawEvents.eventTime))
  
  // 按 viewMode 动态聚合分组
  return groupEventsByTime(events, viewMode)
}
```

**性能优化**：
- 虚拟滚动：仅渲染可视区域的 EventCard
- 分页加载：初始加载最近 30 天记录，滚动加载更早记录
- 缓存策略：聚合视图缓存，减少重复计算

## 五、标签管理系统设计

### 5.1 标签管理页面 (`/tags`)
**页面布局**：
```
┌─────────────────────────────────────────┐
│ 标签管理                                 │
│ [ 新建标签 ]                             │
├─────────────────────────────────────────┤
│ 标签列表 (表格)                          │
│ ┌───────────────────────────────────┐   │
│ │ 标签名 | 映射分类 | 颜色 | 使用次数 │   │
│ │ #工作  | routine   | 🔵   | 125    │   │
│ │ #成果  | achievement| 🟢   | 23     │   │
│ │ #会议  | routine   | 🟡   | 45     │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**表格列**：
- 标签名：显示标签及其颜色
- 映射分类：achievement/risk/routine/plan 下拉选择
- 颜色：颜色选择器（可选）
- 使用次数：统计该标签在 `raw_events` 中的出现次数
- 操作：编辑、删除（内置标签不可删）

**编辑对话框**：
```
TagFormDialog
├─ 标签名输入（必填，唯一性校验）
├─ sectionType 选择器（achievement/risk/routine/plan）
├─ 颜色选择器（可选，预设 10 种颜色）
├─ 保存/取消按钮
```

### 5.2 时间线右侧标签筛选面板
**组件结构**：
```
TagFilterPanel
├─ 标签列表（垂直排列，按使用次数排序）
│  ├─ 每个标签：勾选框 + 标签名 + 使用次数
│  ├─ 支持多选筛选（勾选多个标签）
│  ├─ 筛选逻辑：显示包含任一选中标签的记录
├─ 快速操作
│  ├─ 点击标签名：跳转到 `/tags` 编辑页面
│  ├─ 清除筛选按钮：取消所有筛选
```

**筛选逻辑**：
```typescript
// 多标签筛选（OR 逻辑）
async function filterByTags(selectedTags: string[]) {
  return await db.select()
    .from(rawEvents)
    .where(sql`${rawEvents.tags} LIKE ANY ${selectedTags}`)
    .orderBy(desc(rawEvents.eventTime))
}
```

### 5.3 内置预设标签
**系统初始化时自动创建**：
| 标签名 | sectionType | 颜色 | 说明 |
|--------|-------------|------|------|
| `工作` | routine | 🔵 蓝色 | 日常工作记录 |
| `成果` | achievement | 🟢 绿色 | 工作成果和亮点 |
| `风险` | risk | 🔴 红色 | 问题与风险 |
| `计划` | plan | 🟡 黄色 | 下周计划 |
| `会议` | routine | 🟣 紫色 | 会议记录 |
| `重要` | achievement | 🟠 橙色 | 重要事项（同时标记 isImportant=true） |

**初始化逻辑**：
- 系统启动时检查 `tags` 表是否为空
- 若为空，自动创建上述 6 个内置标签
- 内置标签标记 `isBuiltIn=true`，用户不可删除

## 六、Memo 输入交互设计

### 6.1 QuickInputBar 组件
**组件位置**：时间线页面顶部，固定显示

**交互流程**：
```
用户输入："完成产品需求评审 #成果 #工作"
↓
实时解析：
  - 正则匹配：#[\w\u4e00-\u9fa5]+
  - 提取标签：["成果", "工作"]
  - 高亮显示标签（蓝色底色）
  - 剩余内容："完成产品需求评审"
↓
保存触发：回车键
↓
数据入库：
  - content: "完成产品需求评审"
  - tags: ["成果", "工作"]
  - eventTime: 当前时间戳
  - source: 'manual'
  - sectionType: 查询 tags 表，"成果" → achievement
↓
反馈：
  - Toast 提示 "已记录"
  - 清空输入框
  - 自动刷新时间线，新记录出现在最上方
```

### 6.2 标签解析规则
**正则表达式**：
```typescript
const TAG_REGEX = /#([\w\u4e00-\u9fa5]+)/g
```

**解析逻辑**：
```typescript
function parseTags(input: string): { content: string, tags: string[] } {
  const tags: string[] = []
  const content = input.replace(TAG_REGEX, (match, tag) => {
    tags.push(tag)
    return ''  // 移除标签，保留纯文本
  }).trim()
  
  return { content, tags }
}
```

**示例**：
| 输入 | 解析结果 |
|------|----------|
| `完成评审 #成果 #工作` | content: "完成评审", tags: ["成果", "工作"] |
| `开会讨论方案 #会议` | content: "开会讨论方案", tags: ["会议"] |
| `修复登录 bug #工作 #风险` | content: "修复登录 bug", tags: ["工作", "风险"] → sectionType: risk（优先级） |

### 6.3 未识别标签处理
**新标签自动创建**：
- 用户输入新标签（如 `#新标签`），系统检测 `tags` 表不存在该标签
- 自动创建新标签记录：
  - `name: "新标签"`
  - `sectionType: "routine"`（默认）
  - `isBuiltIn: false`
- 用户可在 `/tags` 页面调整映射关系

**标签下拉提示**（可选，后续迭代）：
- 输入 `#` 时，下拉显示已有标签列表
- 支持快速选择，避免重复创建相似标签
- 当前阶段不实现，保持输入体验简洁

### 6.4 输入增强功能（后续迭代）
- **时间戳语法**：`@2024-01-15` 指定记录时间
- **优先级语法**：`!重要` 快速标记 isImportant
- **批量导入**：支持多行输入，批量创建记录
- **附件上传**：支持图片、文件附件（存储到 metadata）

## 七、与周报的集成设计

### 7.1 自动导入流程
**新建周报时的素材导入**：
```
用户选择周报日期范围（weekStart → weekEnd）
↓
系统查询 raw_events 表：
  WHERE eventTime BETWEEN weekStart AND weekEnd
  AND status = 'pending'
↓
对每条记录执行分类：
  ├─ 解析 tags 字段
  ├─ 查询 tags 表获取 sectionType 映射
  ├─ 未配置映射的标签 → routine
  ├─ 多标签冲突：优先级 achievement > risk > plan > routine
↓
按 sectionType 分组填充到模板：
  ├─ achievement → 核心成果区块
  ├─ risk → 问题与风险区块
  ├─ routine → 日常事务区块
  ├─ plan → 下周计划区块
↓
填充完成后，更新记录状态：
  UPDATE raw_events SET status = 'processed'
```

### 7.2 与现有功能的兼容性
**Git 采集记录**：
- 保持现有流程，`source='github/gitlab/local-git'`
- 无 tags 字段，保持手动分类流程
- 在周报编辑器中可手动调整 sectionType

**手动 Memo 记录**：
- 新增流程，`source='manual'`
- 自动携带 tags 和 sectionType 映射
- 在周报编辑器中可手动调整分类

**统一处理**：
- 两者共享同一套周报生成逻辑
- 填充到模板后，用户可在编辑器中自由调整
- 无差异化处理，符合"单一数据源"原则

### 7.3 周报编辑器增强（可选，后续迭代）
**素材管理面板**：
- 在周报编辑器侧边栏新增"本周素材列表"
- 显示本周所有记录（Git + Memo）
- 支持手动添加遗漏记录、删除不需要的记录
- 可视化展示素材使用情况（已用/未用）

**记录溯源**：
- 点击周报中的条目，跳转到原始记录
- 显示记录的完整上下文（时间、标签、来源）
- 方便追溯和补充细节

## 八、技术实现要点

### 8.1 前端状态管理
**时间线状态**：
```typescript
interface TimelineState {
  viewMode: 'day' | 'week' | 'month'
  selectedTags: string[]
  events: RawEvent[]
  editingEventId: number | null
  loading: boolean
}
```

**标签管理状态**：
```typescript
interface TagsState {
  tags: Tag[]
  editingTagId: number | null
  loading: boolean
}
```

### 8.2 API 接口设计
**时间线接口**：
```
GET /api/events?viewMode=day&tags=工作,会议
POST /api/events (创建 Memo 记录)
PUT /api/events/[id] (编辑记录)
DELETE /api/events/[id] (删除记录，仅 manual 来源)
```

**标签管理接口**：
```
GET /api/tags (获取所有标签)
POST /api/tags (新建标签)
PUT /api/tags/[id] (编辑标签映射)
DELETE /api/tags/[id] (删除标签，仅非内置)
GET /api/tags/stats (获取标签使用统计)
```

**周报生成接口**：
```
GET /api/events?weekStart=2024-01-08&weekEnd=2024-01-14&status=pending
POST /api/reports (创建周报，自动导入素材)
```

### 8.3 数据库迁移
**迁移脚本**：
```sql
-- 创建 tags 表
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  section_type TEXT,
  color TEXT,
  is_built_in INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 扩展 raw_events 表
ALTER TABLE raw_events ADD COLUMN tags TEXT;
ALTER TABLE raw_events ADD COLUMN is_important INTEGER DEFAULT 0;

-- 初始化内置标签
INSERT INTO tags (name, section_type, color, is_built_in, created_at, updated_at)
VALUES 
  ('工作', 'routine', 'blue', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('成果', 'achievement', 'green', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('风险', 'risk', 'red', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('计划', 'plan', 'yellow', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('会议', 'routine', 'purple', 1, strftime('%s', 'now'), strftime('%s', 'now')),
  ('重要', 'achievement', 'orange', 1, strftime('%s', 'now'), strftime('%s', 'now'));
```

### 8.4 性能优化策略
**查询优化**：
- 为 `raw_events.eventTime` 创建索引，加速时间范围查询
- 为 `raw_events.tags` 创建索引，加速标签筛选
- 虚拟滚动组件，仅渲染可视区域卡片

**缓存策略**：
- 时间线聚合视图缓存（1 分钟 TTL）
- 标签列表缓存（全局缓存）
- 标签使用统计缓存（5 分钟 TTL）

**前端优化**：
- React.memo 优化 EventCard 组件，避免不必要的重渲染
- 使用 useDeferredValue 延迟筛选计算，避免输入卡顿
- 骨架屏加载状态，提升用户体验

## 九、后续迭代方向

### 9.1 高优先级（下一版本）
- **时间线全文搜索**：支持搜索记录内容
- **记录附件**：支持上传图片、文件
- **批量操作**：批量删除、批量修改标签

### 9.2 中优先级
- **标签下拉提示**：输入 `#` 时提示已有标签
- **时间戳语法**：支持 `@2024-01-15` 指定记录时间
- **周报编辑器素材面板**：可视化管理本周素材

### 9.3 低优先级
- **记录模板**：预设记录模板（如会议记录模板）
- **AI 自动分类**：AI 根据内容自动推荐标签
- **记录导出**：导出时间线为 Markdown/PDF

## 十、测试验收标准

### 10.1 功能测试
- **输入测试**：#标签语法正确解析，新标签自动创建
- **时间线测试**：日/周/月聚合正确，记录按时间倒序
- **标签管理测试**：映射规则正确，内置标签不可删除
- **周报生成测试**：素材自动导入，分类映射正确

### 10.2 性能测试
- **加载性能**：时间线初始加载 < 1 秒
- **输入响应**：输入框响应 < 100ms
- **筛选性能**：标签筛选响应 < 500ms

### 10.3 兼容性测试
- **向后兼容**：现有周报功能无影响
- **数据兼容**：Git 采集记录与 Memo 记录共存
- **路由兼容**：现有路由调整后页面功能正常

---

**设计文档版本**: v1.0  
**创建日期**: 2026-07-05  
**设计者**: AI Assistant + User Collaboration  
**状态**: 待审核