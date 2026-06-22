# 周报写作助手功能设计

## 目标

帮助用户写出"好"的周报，解决四大痛点：
1. 不知道写什么
2. 写出来太流水账
3. 写完觉得没重点
4. 耗时太长

## 好周报的标准

- **结构清晰**：固定模板引导，区块分明
- **内容充实**：有具体数据和事实支撑
- **突出价值**：强调成果和贡献，使用成果动词
- **简洁高效**：信息密度高，领导一眼能看懂重点

## 受众

- 直属领导：汇报工作进度、申请资源、沟通问题
- 自己：复盘总结、个人成长记录

## MVP 功能范围

1. **模板系统**：默认模板 + 用户自定义模板
2. **智能建议**：实时提示 + 完成后评分

后续迭代：历史参考（快速检索、亮点片段库、统计趋势）

---

## 一、模板系统

### 默认模板结构

```markdown
## 本周完成
- [工作项1：描述 + 成果/价值]
- [工作项2：描述 + 成果/价值]

## 进行中
- [项目/任务名称：进度描述 + 预计完成时间]

## 遇到的问题
- [问题描述 + 原因分析 + 已采取措施/需要支持]

## 下周计划
- [计划事项 + 优先级]
```

### 自定义模板

- 用户可创建、编辑、删除自己的模板
- 模板包含：名称、结构（Markdown）、适用工作类型标签
- 存储在数据库 templates 表

---

## 二、智能建议系统

### 技术方案：云端 AI API

使用云端 AI API 分析周报内容，返回智能建议和评分：
- 实时提示：调用 AI API 分析当前内容，返回优化建议
- 完成后评分：调用 AI API 进行完整评估，生成评分报告

### 实时提示（前端 + AI API）

写作过程中，定期调用 AI API 分析当前区块内容：

| 检查项 | AI 分析内容 | 提示文案 |
|--------|-------------|----------|
| 区块填写 | 是否有实质内容 | "✓ 已填写" 或 "✗ 未填写" |
| 内容质量 | 是否有具体细节和数据 | "⚠ 建议添加具体数据支撑" |
| 价值突出 | 是否强调成果和价值 | "⚠ 建议突出成果和价值" |
| 表达优化 | 是否有更好的表达方式 | "建议：[AI 生成的改写建议]" |

### 完成后评分（AI API）

提交保存前，调用 AI API 进行完整评估：

**评分维度**（AI 评估）：
- **结构完整度**（0-100）：各区块是否填写完整
- **内容充实度**（0-100）：是否有具体细节和数据支撑
- **价值突出度**（0-100）：是否强调成果和贡献
- **整体评分**：AI 综合评估

**改进建议**（AI 生成）：
- 具体改进建议（如："本周完成缺少具体数据，建议添加完成数量或效率提升百分比"）
- 可选：AI 生成的改写示例

---

## 三、数据库设计

新增 templates 表：

```sql
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- 模板名称
  content TEXT NOT NULL,        -- Markdown 内容
  work_types TEXT,              -- 适用工作类型（逗号分隔）
  is_default BOOLEAN DEFAULT 0, -- 是否默认模板
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

默认模板在应用启动时自动初始化。

---

## 四、UI 交互设计

### 新建周报页面

1. **模板选择**：下拉菜单（默认模板 + 自定义模板列表）
2. **编辑器**：预填充模板内容，各区块用 Markdown 标题分隔
3. **实时提示面板**（右侧或底部）：
   - 填写进度条
   - 各区块状态（✓ / ⚠ / ✗）
   - 具体建议文案

### 保存流程

1. 点击保存 → 弹出评分面板
2. 显示四维度评分 + 改进建议
3. 用户选择：直接保存 / 返回修改

### 模板管理页面

- 路径：`/templates`
- 功能：模板列表、新建、编辑、删除
- 默认模板只读，不可删除

---

## 五、API 设计

### 模板相关

- `GET /api/templates` — 获取模板列表
- `POST /api/templates` — 创建自定义模板
- `PUT /api/templates/[id]` — 编辑模板
- `DELETE /api/templates/[id]` — 删除模板（默认模板不可删）

### 智能建议

- `POST /api/reports/check` — 提交周报内容，返回评分和建议

请求：
```json
{
  "content": "周报 Markdown 内容"
}
```

响应：
```json
{
  "score": {
    "structure": 80,
    "content": 60,
    "value": 50,
    "overall": 64
  },
  "suggestions": [
    "本周完成：建议添加具体数据支撑",
    "遇到的问题：未填写"
  ]
}
```

---

## 六、技术实现

### AI API 调用设计

**实时提示 API**：
```typescript
interface CheckRequest {
  content: string      // 当前区块或全文内容
  section?: string     // 当前区块名称（可选）
}

interface CheckResponse {
  suggestions: string[]  // 改进建议列表
  score?: number         // 当前区块评分（可选）
}

// 调用 AI API
async function checkContent(request: CheckRequest): Promise<CheckResponse> {
  const response = await fetch('/api/reports/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}
```

**评分 API**：
```typescript
interface ScoreRequest {
  content: string  // 周报全文
}

interface ScoreResponse {
  score: {
    structure: number    // 结构完整度 0-100
    content: number      // 内容充实度 0-100
    value: number        // 价值突出度 0-100
    overall: number      // 整体评分 0-100
  }
  suggestions: string[]  // 改进建议列表
  rewriteExamples?: {    // 可选：改写示例
    original: string
    improved: string
  }[]
}
```

### 区块解析（前端）

从 Markdown 内容中提取各区块：

```typescript
function parseSections(content: string): Record<string, string> {
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
```

### AI Prompt 设计

**实时提示 Prompt**：
```
你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
{content}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字）。
```

**评分 Prompt**：
```
你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
{content}

请从以下维度评分（0-100）：
1. 结构完整度：各区块是否填写完整
2. 内容充实度：是否有具体细节和数据
3. 价值突出度：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议
3. （可选）改写示例
```

### API 配置

需要配置 AI API Key：
- 存储在环境变量或用户配置
- 支持 OpenAI、Claude、或其他兼容 API

---

## 七、实现优先级

1. **模板系统**（P0）
   - 数据库表迁移
   - 默认模板初始化
   - 模板 CRUD API
   - 模板管理页面
   - 新建周报页面集成模板选择

2. **AI API 集成**（P0）
   - 配置 AI API Key（环境变量或用户配置）
   - 实现检查 API `/api/reports/check`
   - AI Prompt 设计和优化

3. **智能建议 UI**（P0）
   - 区块解析逻辑
   - 实时提示面板
   - 评分面板
   - 改进建议展示

---

## 八、后续迭代方向

1. **历史参考**
   - 快速检索：搜索历史周报片段
   - 亮点片段库：自动提取优秀片段
   - 统计趋势：展示工作类型占比

2. **AI 增强**
   - 智能改写功能：一键优化表达
   - 自动生成初稿：根据工作记录自动生成周报草稿
   - 多模型支持：支持切换不同 AI 模型