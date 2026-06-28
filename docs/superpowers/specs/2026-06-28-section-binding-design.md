# 模板区块与事件素材自动绑定渲染系统设计

## 背景

**前置条件**：
- 已完成远程 Git 采集
- raw_events 事件表已存在
- P0/P1 模板变量系统已实现

**核心问题**：
每周手动编写周报效率低，需要将 Git commit 事件自动映射到模板区块，生成完整周报初稿。

## 需求

**本阶段目标**：
- 纯规则驱动填充，不调用 AI
- 完全兼容旧周报、旧模板
- 每周只需：同步 Git → 手动标记少量事件 → 一键生成周报

**具体需求**：
1. raw_events 新增字段：sectionType（核心成果/问题风险/日常事务/下周计划）
2. 前端素材归集页：可手动标记事件属于哪个模板区块
3. 模板配置新增区块渲染规则（maxItems/autoSort/filterTrivial）
4. 新建周报流程升级：自动读取本周事件 → 根据 sectionType 自动填充
5. 自动生成完整 markdown 初稿后跳转编辑器

## 设计方案

### 方案选择

**推荐方案**：渐进式扩展现有系统

**理由**：
- 用户要求完全兼容旧周报、旧模板
- 现有架构已有良好基础
- 改动小、风险低、易于测试

### 1. 数据库设计

**schema.ts 新增字段**：

```typescript
// raw_events 表新增 sectionType 字段
export const rawEvents = sqliteTable('raw_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventTime: integer('event_time', { mode: 'timestamp' }).notNull(),
  source: text('source').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<RawEventMetadata>(),
  category: text('category'),
  sectionType: text('section_type').default('routine').notNull(), // 新增
  status: text('status').default('pending').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// sectionType 枚举值定义
export type SectionType = 'achievement' | 'risk' | 'routine' | 'plan'
```

**迁移策略**：
- 使用 Drizzle Kit 生成 migration
- 新字段默认值 `routine`，确保旧数据兼容

### 2. 模板配置扩展

**TemplateConfig 扩展**：

```typescript
export interface SectionRenderConfig {
  maxItems?: number          // 最多展示N条，默认无限制
  autoSort?: boolean         // 是否自动排序（按时间），默认true
  filterTrivial?: boolean    // 是否过滤琐碎事件，默认false
}

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
}
```

**琐碎事件过滤规则**：

```typescript
const TRIVIAL_KEYWORDS = [
  'fix typo', 'update comment', 'refactor minor',
  'chore', 'docs', 'formatting', 'whitespace'
]

function isTrivialEvent(content: string): boolean {
  if (content.length < 50) return true
  const lowerContent = content.toLowerCase()
  return TRIVIAL_KEYWORDS.some(kw => lowerContent.includes(kw))
}
```

### 3. 模板渲染逻辑

**扩展 RenderOptions 和 renderTemplate**：

```typescript
export interface RenderOptions {
  date?: Date
  events?: RawEvent[]  // 新增
  sectionConfig?: TemplateConfig['sectionConfig']  // 新增
}

export function renderTemplate(content: string, options?: RenderOptions): string {
  const baseDate = options?.date ?? new Date()
  
  let result = content
  
  // 1. 处理系统变量（日期等）- 复用现有逻辑
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 })
  const weekRange = `${format(weekStart, 'yyyy.MM.dd')} - ${format(weekEnd, 'yyyy.MM.dd')}`
  result = result.replace(/\{\{本周日期范围\}\}/g, weekRange)
  
  // ... 其他系统变量
  
  // 2. 处理 section 变量（扩展）
  const sectionVariables: Record<SectionType, string> = {
    achievement: '核心成果',
    risk: '问题与风险',
    routine: '日常事务',
    plan: '下周计划',
  }
  
  for (const [type, variableName] of Object.entries(sectionVariables)) {
    const pattern = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g')
    
    if (options?.events) {
      const events = filterAndFormatEvents(
        options.events,
        type as SectionType,
        options.sectionConfig?.[type as SectionType]
      )
      result = result.replace(pattern, events)
    } else {
      // 向后兼容：无 events 时用空列表
      result = result.replace(pattern, '- \n- \n- ')
    }
  }
  
  return result
}

function filterAndFormatEvents(
  events: RawEvent[],
  type: SectionType,
  config?: SectionRenderConfig
): string {
  let filtered = events.filter(e => e.sectionType === type)
  
  // 应用渲染规则
  if (config?.filterTrivial) {
    filtered = filtered.filter(e => !isTrivialEvent(e.content))
  }
  
  if (config?.autoSort) {
    filtered.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime())
  }
  
  if (config?.maxItems) {
    filtered = filtered.slice(0, config.maxItems)
  }
  
  if (filtered.length === 0) return '- \n- \n- '
  return filtered.map(e => `- ${e.content}`).join('\n')
}
```

### 4. 前端事件标记功能

**素材归集页改造**（src/app/collect/page.tsx）：

```typescript
// 增加事件列表组件
<CollectSourceList onRefresh={handleRefreshReady} />

// 新增：本周事件列表（可标记区块类型）
<EventListForMarking 
  weekStart={weekStart}
  weekEnd={weekEnd}
/>
```

**新组件 EventListForMarking**（src/components/EventListForMarking.tsx）：

```typescript
export function EventListForMarking({ weekStart, weekEnd }) {
  const [events, setEvents] = useState<RawEvent[]>([])
  
  useEffect(() => {
    fetch(`/api/events?weekStart=${weekStart}&weekEnd=${weekEnd}`)
      .then(res => res.json())
      .then(data => setEvents(data.events))
  }, [weekStart, weekEnd])
  
  async function handleMarkSectionType(eventId: number, sectionType: SectionType) {
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify({ sectionType })
    })
    // 刷新列表
  }
  
  return (
    <div className="mt-8">
      <h2>本周事件素材</h2>
      <table>
        {events.map(event => (
          <tr key={event.id}>
            <td>{format(event.eventTime, 'MM-dd')}</td>
            <td>{event.content}</td>
            <td>
              <Select 
                value={event.sectionType}
                onChange={(val) => handleMarkSectionType(event.id, val)}
              >
                <option value="achievement">核心成果</option>
                <option value="risk">问题风险</option>
                <option value="routine">日常事务</option>
                <option value="plan">下周计划</option>
              </Select>
            </td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

**新增 API routes**：
- `src/app/api/events/route.ts` - GET 查询本周事件
- `src/app/api/events/[id]/route.ts` - PATCH 更新 sectionType

### 5. 新建周报流程改造

**新建周报页面改造**（src/app/new/page.tsx）：

```typescript
// 新增状态
const [eventsDialogOpen, setEventsDialogOpen] = useState(false)
const [selectedEvents, setSelectedEvents] = useState<RawEvent[]>([])

async function handleGenerateDraft() {
  if (!selectedTemplateId || selectedEvents.length === 0) {
    toast.error('请选择模板和事件')
    return
  }
  
  const response = await fetch('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({
      templateId: selectedTemplateId,
      events: selectedEvents,
      weekStart,
      weekEnd,
      title
    })
  })
  
  const report = await response.json()
  
  // 跳转编辑页面
  router.push(`/edit/${report.id}`)
}

return (
  <form>
    {/* 现有的模板选择、日期选择 */}
    
    {/* 新增：选择本周事件按钮 */}
    <Button onClick={() => setEventsDialogOpen(true)}>
      <ListChecks className="h-4 w-4 mr-2" />
      选择本周事件 ({selectedEvents.length})
    </Button>
    
    {/* 事件选择弹窗 */}
    <EventsSelectDialog
      open={eventsDialogOpen}
      onClose={() => setEventsDialogOpen(false)}
      weekStart={weekStart}
      weekEnd={weekEnd}
      onConfirm={(events) => {
        setSelectedEvents(events)
        setEventsDialogOpen(false)
      }}
    />
    
    {/* 新增：一键生成按钮 */}
    <Button onClick={handleGenerateDraft}>
      <Sparkles className="h-4 w-4 mr-2" />
      一键生成周报
    </Button>
  </form>
)
```

**新组件 EventsSelectDialog**（src/components/EventsSelectDialog.tsx）：

```typescript
export function EventsSelectDialog({ open, onClose, weekStart, weekEnd, onConfirm }) {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  // 按区块类型分组展示
  const groupedEvents = {
    achievement: events.filter(e => e.sectionType === 'achievement'),
    risk: events.filter(e => e.sectionType === 'risk'),
    routine: events.filter(e => e.sectionType === 'routine'),
    plan: events.filter(e => e.sectionType === 'plan'),
  }
  
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogTitle>选择本周事件</DialogTitle>
        <div className="space-y-4">
          {Object.entries(groupedEvents).map(([type, typeEvents]) => (
            <div key={type}>
              <h3>{SECTION_TYPE_LABELS[type]}</h3>
              {typeEvents.map(event => (
                <Checkbox
                  checked={selectedIds.has(event.id)}
                  onChange={() => toggleSelection(event.id)}
                >
                  {event.content}
                </Checkbox>
              ))}
            </div>
          ))}
        </div>
        <Button onClick={() => onConfirm(events.filter(e => selectedIds.has(e.id)))}>
          确定
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

**新增 API route**：
- `src/app/api/reports/generate/route.ts` - POST 生成周报初稿并保存

### 6. 兼容性设计

**向后兼容策略**：

1. **数据库迁移兼容**：
   - 新字段默认值 `routine`
   - 旧数据自动标记为日常事务

2. **模板配置兼容**：
   - TemplateConfig 扩展可选
   - 旧模板不传 sectionConfig 时使用默认规则

3. **模板渲染兼容**：
   - renderTemplate 函数向后兼容
   - 不传 events 时保持原有行为（空列表填充）

4. **旧周报兼容**：
   - 旧周报内容不受影响
   - 编辑页面可正常打开

5. **事件标记兼容**：
   - 未标记事件默认 routine
   - 旧采集源同步的事件自动标记 routine

**测试策略**：
- 旧模板渲染测试：确保无 events 时生成空列表
- 旧周报编辑测试：确保编辑页面正常工作
- 旧采集源测试：确保新事件默认 routine

## 实现计划

**阶段划分**：
1. 数据库 schema 扩展 + migration
2. 模板配置扩展
3. 模板渲染逻辑扩展
4. 前端事件标记功能
5. 新建周报流程改造
6. 兼容性测试

**预估工作量**：
- 数据库：1-2小时
- 模板渲染：2-3小时
- 前端组件：3-4小时
- API routes：2-3小时
- 测试：1-2小时
- 总计：9-14小时

## 风险与依赖

**技术风险**：
- 低：扩展现有系统，风险可控

**外部依赖**：
- 无新依赖

**约束**：
- 本阶段不调用 AI，纯规则驱动
- 完全兼容旧数据

## 成功标准

**验收条件**：
1. raw_events 表新增 sectionType 字段，默认 routine
2. 素材归集页可手动标记事件类型
3. 模板配置支持区块渲染规则
4. 新建周报可选择事件并自动填充
5. 生成的周报可跳转编辑页二次编辑
6. 旧周报、旧模板正常工作

## 后续规划

**下一阶段**：
- AI 智能润色
- AI 自动分类事件
- 更智能的模板推荐