# Context

## 采集源同步

### 同步游标 (Sync Cursor)
每个采集源的每个分支独立维护的同步进度标记。值为该分支上次同步拉取到的 commit 中最大的 **committer date**。下次同步时作为 `since` 参数传入 API，保证时间缝隙内被延迟推送的 commit 不被漏掉。
存储位置：`collect_sources.config.branches[i].lastCommitTime`。
_Avoid_: lastSyncAt（这是同步操作时间，不是数据游标）

### Committer date vs Author date
- **Author date**：变更最初撰写的时间。amend/rebase 不改变。用于 `eventTime`（面向用户展示「工作何时发生」）。
- **Committer date**：commit 写入仓库的时间。amend/rebase 会更新。用于同步游标（面向 API 的数据边界）。
_Avoid_: 混用二者。UI 展示用 author date，sync cursor 用 committer date。

### 时间缝隙 (Time Gap)
同步操作发生时间 T 与最后一个 commit 的 committer date T-Δ 之间的间隙。若以 T 作为下次 sync 的 `since`，在 T-Δ 到 T 之间被延迟推送的 commit 会被漏掉。以 committer date 作为 cursor 可消除此缝隙。

## AI 集成

### 协议格式 (Protocol Format)
AI 服务使用的通信协议。两种：**OpenAI-compatible**（chat completions 格式，Qwen/DeepSeek 等兼容）和 **Anthropic**（messages 格式）。决定底层 SDK 选择和请求构造方式。
_Avoid_: provider（这是品牌概念，这里指的是协议格式）

### AI 配置 (AI Configuration)
全局唯一的 AI 服务连接配置，存储在数据库中。包含：协议格式、API URL、API Key、当前模型名。单用户应用，不做加密。环境变量不参与配置——完全由数据库驱动。
_Avoid_: AI settings, AI params, .env 配置

### 模型列表拉取 (Model List Fetching)
OpenAI 协议下通过 `GET /models` 端点自动获取可用模型列表供用户选择。拉取失败时回退为手动输入。Anthropic 协议无此端点，始终手动输入模型名。
_Avoid_: model discovery, model enumeration

## 周报评分

### 评分状态 (Score Status)
周报评分的生命周期状态，用于跟踪异步评分进度。四种状态：
- **pending**: 周报已保存，等待评分
- **scoring**: 正在调用 AI 评分
- **completed**: 评分完成，分数可用
- **failed**: 评分失败（AI 服务异常等）

存储位置：`reports.scoreStatus` 字段。
_Avoid_: scoreState（这是 UI 状态概念，不是数据状态）

### 异步评分 (Async Scoring)
周报保存后立即触发的后台评分流程。用户无需等待评分完成即可完成保存操作。评分结果持久化到数据库，在周报列表中展示。

**触发时机**：周报创建或更新后立即调用评分 API（不等待响应）。
**用户体验**：保存时无阻塞，分数稍后出现在列表项中。
**失败处理**：评分失败时状态标记为 `failed`，支持手动重新评分。

_Avoid_: 同步评分、阻塞式评分

### 评分维度 (Score Dimensions)
AI 对周报质量的评分维度，包含三个子维度和一个综合分：
- **结构完整度 (Structure)**: 周报是否包含必要章节（如本周工作、下周计划等）
- **内容充实度 (Content)**: 各章节内容是否详实具体
- **价值突出度 (Value)**: 是否突出工作成果和价值
- **综合评分 (Overall)**: 加权总分

权重配置存储在 AI 风格设置（`AIStyle.scoreWeights`）中。
存储位置：`reports.score` 字段（JSON 格式）。

_Avoid_: rating（混淆为星级评分）

### 评分建议 (Score Suggestions)
AI 基于评分结果给出的改进建议列表。存储位置：`reports.suggestions` 字段。

## 周报视图

### 项目范围 (Project Scope)
采集源的项目分类属性，用于区分工作项目和个人项目。影响周报不同视图的内容筛选：
- **工作项目 (work)**：领导版和个人版周报均显示
- **个人项目 (personal)**：仅个人版周报显示

存储位置：`collect_sources.projectScope` 字段。
默认值：`personal`（新建采集源默认为个人项目）。
_Avoid_: visibility（混淆为公开/私密概念）、category（过于宽泛）

### 视图类型 (View Type)
周报渲染的目标视图，决定内容筛选和展示策略：
- **领导版 (leadership)**：仅显示工作项目事件和手动录入内容，精简结构，正式风格
- **个人版 (personal)**：显示全部事件（工作+个人项目），完整结构，详细风格

存储位置：模板的 `config.viewConfigs.leadership` / `config.viewConfigs.personal`。
_Avoid_: reportType（混淆为周报类型）、audience（这是受众概念）

### 手动事件 (Manual Event)
用户在周报编辑器中手动添加的事件条目，区别于采集源自动同步的事件。手动事件不受项目范围过滤限制，在领导版和个人版中均显示。
判断依据：`raw_events.metadata.sourceId` 为空。
_Avoid_: custom event、user event（语义不够精确）

## 提示词管理

### AI 风格 (AI Style)
AI 润色/扩写/风格统一时使用的写作风格配置，包含 system prompt、temperature、评分权重等参数。支持完整 CRUD，存储在 `ai_styles` 表中。用户可为模板和周报选择不同的 AI 风格。
_Avoid_: style preset、writing style（与 UI 风格混淆）

### 风格标识 (Style Key)
AI 风格的唯一英文标识符，格式 `[a-z][a-z0-9_-]*`。由用户在创建风格时手动填写或随机生成。替代旧的硬编码联合类型 `AIStyle`。
_Avoid_: styleId（那是数据库主键）、styleName（混淆中文标签）

### 默认风格 (Default Style)
`ai_styles` 表中有且仅有一个的风格，由 `is_default` 字段标记。当引用的风格被删除导致 key 失效时，系统回退到默认风格。最后一个风格禁止删除。
_Avoid_: fallback style、primary style

### 系统提示词 (System Prompt)
`checkContent` 和 `scoreReport` 使用的提示词模板，全局唯一、只可编辑。存储在 `system_prompts` 表中。模板中可使用 `{{变量}}` 占位符在运行时替换。
_Avoid_: built-in prompt、hardcoded prompt

### 提示词管理页面 (Prompts Management Page)
位于 `/prompts` 的独立管理页面，包含"风格管理"和"系统提示词"两个 Tab。对标 `/templates` 模板管理页面。
_Avoid_: prompt settings、AI settings page

## 模态框交互

### ESC 键行为

**取消（Cancel）**：按 ESC 键时的行为取决于当前焦点状态。

**规则**：
- 如果 autocomplete 下拉菜单打开（`showSuggestions === true`）→ 只关闭下拉菜单
- 否则 → 关闭整个对话框

**适用场景**：
- 手搓的模态框（如 `ScanReposDialog`）需要显式实现 ESC 处理
- 使用 Base UI `Dialog` 组件的模态框已内置 ESC 支持，通过 `onOpenChange` 自动触发

**两步流程**：
- `step === 'result'` 时，ESC 直接关闭对话框（不回退到上一步）

**实现模式**：
```typescript
useEffect(() => {
  if (!open) return

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showSuggestions) {
        setShowSuggestions(false)
      } else {
        onClose()
      }
    }
  }

  document.addEventListener('keydown', handleEscape)
  return () => document.removeEventListener('keydown', handleEscape)
}, [open, showSuggestions, onClose])
```
