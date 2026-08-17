# Context

## 采集源

### 路径展开 (Path Expansion)
用户输入的本地目录路径在服务端的统一解释规则，对所有接受路径输入的入口一致生效：
- `~` 或 `~/` 开头 → 展开为 `$HOME`（不支持 `~user` 形式）
- 相对路径 → 解析到 `$HOME` 下
- 绝对路径 → 原样使用
- `~` 不出现在开头时不展开
- 输入先去首尾空白，结果经规范化（合并重复分隔符、消解 `.` / `..`）
- 结尾斜杠被保留，作为「列出该目录内容」的信号，仅目录补全消费；落库路径一律不带结尾斜杠

输入框始终保留用户原文，展开只发生在服务端。
_Avoid_: shell 展开（那是客户端/终端行为，这里特指服务端规则）

## 采集源同步

### 同步游标 (Sync Cursor)
同步进度标记。git-local 采集源和远端采集源（GitHub/GitLab）均按**分支**独立维护游标（值为该分支上次同步拉取到的 commit 中最大的 **committer date**）。下次同步时作为 `since` 参数传入 API，保证时间缝隙内被延迟推送的 commit 不被漏掉。
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
终版周报评分的生命周期状态，每个受众版本独立跟踪。四种状态：
- **pending**: 周报已保存，等待评分
- **scoring**: 正在调用 AI 评分
- **completed**: 评分完成，分数可用
- **failed**: 评分失败（AI 服务异常等）

存储位置：`report_variants.scoreStatus` 字段；旧版周报兼容字段仍位于 `reports`。
_Avoid_: scoreState（这是 UI 状态概念，不是数据状态）

### 异步评分 (Async Scoring)
终版周报生成或编辑后触发的后台评分流程。用户无需等待评分完成即可保存内容，周报原稿不参与评分。

**触发时机**：某一受众版本的终版周报生成或更新后立即开始评分（不等待响应）。
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
存储位置：每个受众版本的 `report_variants.score_*` 字段。

_Avoid_: rating（混淆为星级评分）

### 评分建议 (Score Suggestions)
AI 基于评分结果给出的改进建议列表。存储位置：`report_variants.suggestions` 字段；旧版周报兼容字段仍位于 `reports`。

## 周报内容

### 项目范围 (Project Scope)
采集源的项目分类属性，用于区分工作项目和个人项目。影响周报不同受众版本的内容筛选：
- **工作项目 (work)**：领导版和个人版周报均显示
- **个人项目 (personal)**：仅个人版周报显示

存储位置：`collect_sources.projectScope` 字段。
默认值：`personal`（新建采集源默认为个人项目）。
_Avoid_: visibility（混淆为公开/私密概念）、category（过于宽泛）

### 受众版本 (Audience Variant)
同一篇周报面向不同读者保存的内容版本：**领导版 (leadership)** 包含工作项目事件和手动事件，**个人版 (personal)** 包含全部事件。两种版本都从创建时确定的事件快照独立产生。
_Avoid_: 视图类型（内容已经持久化，不是临时视图）、reportType（混淆为周报类型）

### 周报原稿 (Report Source Draft)
根据某一受众版本的事件快照，以固定事件清单格式确定性生成的只读周报内容。原稿不使用模板或 AI，是后续生成终版周报的事实输入。
_Avoid_: 原始周报（容易与 raw event 混淆）、模板渲染结果

### 事件快照 (Event Snapshot)
创建周报时为某一受众版本选定的事件集合，既保留对来源事件的追溯，也保留当时的事件事实。快照不因后续事件编辑、删除、补采或项目范围变化而静默改变。
_Avoid_: 实时事件列表、动态视图

### 事件清单格式 (Event Inventory Format)
周报原稿使用的固定表达格式：按来源分组优先级和时间排序，Git 事件按仓库形成嵌套列表，不预先划分成果、风险、计划等语义章节。
_Avoid_: 原稿模板、章节模板

### 空周报原稿 (Empty Source Draft)
某一受众版本在指定日期范围内没有可用事件时的原稿，明确显示“本周暂无事件”。空周报原稿可以保存，但不能直接生成终版周报。
_Avoid_: 缺失周报、无效原稿

### 终版周报 (Final Report)
AI 根据一份周报原稿和一份周报模板生成、面向对应受众版本的可编辑周报内容。同一篇周报的领导版和个人版各自维护一个当前终版周报。
_Avoid_: 模板渲染结果（生成过程并非确定性渲染）

### 过期终版 (Stale Final Report)
周报原稿重新生成后，仍基于旧原稿的当前终版周报。过期终版继续保留和展示，但需要明确提示其内容尚未反映最新原稿。
_Avoid_: 无效终版、已删除终版

### 终版生成 (Final Report Generation)
AI 将一个受众版本的周报原稿，按照周报模板的结构和 AI 风格转换为当前终版周报的过程。生成只使用所选受众版本的原稿，不执行跨版本内容转换。
_Avoid_: 模板渲染、视图转换

### 生成预览 (Generation Preview)
终版生成完成但尚未替换当前终版的候选内容。用户确认采用后才成为当前终版；取消或失败不影响已有内容。
_Avoid_: 自动保存生成结果、临时视图

### 周报模板 (Report Template)
描述终版周报目标格式、写作要求和示例的文本规范，由 AI 结合周报原稿理解和执行；应用本身不解析或替换模板中的周报变量。
_Avoid_: 变量模板、确定性渲染模板

### 模板快照 (Template Snapshot)
生成终版周报时采用的周报模板内容副本，与模板身份和实际 AI 风格一同记录，使既有终版不受模板后续修改或删除影响。
_Avoid_: 最新模板、动态模板引用

### 旧版周报 (Legacy Report)
新双版本模型启用前创建、仅保留一份既有内容且没有事件快照的周报。其既有内容视为个人版终版，不自动推断领导版或周报原稿。
_Avoid_: 已迁移周报、原稿缺失的普通周报

### 手动事件 (Manual Event)
用户在周报编辑器中手动添加的事件条目，区别于采集源自动同步的事件。手动事件不受项目范围过滤限制，在领导版和个人版中均显示。
判断依据：`raw_events.metadata.sourceId` 为空。
_Avoid_: custom event、user event（语义不够精确）

### 来源分组 (Origin Group)
创建周报时事件按来源划分的展示优先级分组，决定章节内条目的排序（不影响筛选，筛选仍由受众版本决定）。四组，组间固定优先级：
1. **手动组**：手动事件，权重最高，永远排在章节最前，与时间新旧无关
2. **采集-工作组**：`projectScope = work` 的采集源产生的事件
3. **采集-个人组**：`projectScope = personal` 的采集源产生的事件
4. **其他组**：见下

组内维持原有行为：git 事件按仓库分组，顶层条目按时间倒序。
_Avoid_: 权重分组、事件分组（都不足以区分「按来源」这一依据）

### 其他组 (Other Group)
来源分组中优先级最低的一组：`metadata.sourceId` 指向的采集源已被删除、无法判定工作/个人归属的采集事件。排在采集-个人组之后。渲染方未提供项目范围映射时，所有采集事件同样按其他组处理（安全兜底）。
_Avoid_: orphan event（实现视角，不是领域语言）

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
内容检查、终版生成和周报评分等系统能力使用的全局提示词模板。系统提示词与周报模板是不同概念，可以包含由对应系统能力在运行时提供的变量。
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
