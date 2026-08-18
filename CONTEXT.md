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
用户在终版生成会话中与 AI 多轮协作，将一个受众版本的周报原稿按照周报模板和 AI 风格转换为候选终版的过程。原稿始终是唯一事实来源，生成不读取其他受众版本，也不把对话中新出现的事实直接写入终版。
_Avoid_: 模板渲染、视图转换

### 生成事实约束 (Generation Grounding)
终版生成以当前受众版本的周报原稿作为权威事实输入，并通过生成指令、公开处理摘要和人工提案评审降低虚构风险。应用不要求逐条事实引用，也不以自动事实校验替代用户确认。
_Avoid_: 强制事实引用、自动真实性证明

### 终版生成会话 (Final Generation Session)
绑定一篇周报的受众版本、原稿版本和生成上下文快照的持久化多轮 AI 对话。用户可在同一上下文内持续改进候选终版；上下文发生变化时开启新会话。
_Avoid_: 一次性生成请求、临时聊天

### 会话事实源 (Session System of Record)
应用自身保存并用于恢复终版生成会话的权威记录，包括上下文快照、轮次、消息片段和提案。供应商会话标识可以辅助调用，但不能成为恢复对话的必要条件。
_Avoid_: 供应商托管会话、浏览器临时状态

### 会话标题 (Session Title)
用于在同一受众版本的多场终版生成会话之间进行识别的名称。默认由模板名称和创建时间组成，用户可以重命名。
_Avoid_: 周报标题、模型会话 ID

### 生成上下文快照 (Generation Context Snapshot)
终版生成会话开始时固定的原稿版本、模板、AI 风格和有效系统提示词集合，使会话内的 AI 输出保持可追溯和可重放。
_Avoid_: 最新生成配置、动态上下文

### 原稿概览 (Source Draft Overview)
终版生成对话中由应用确定性产生、用于代表完整周报原稿的简短可见摘要。AI 仍接收完整原稿作为事实输入，原稿概览只用于避免对话记录被长原稿淹没。
_Avoid_: 原稿正文、事实来源

### 公开过程记录 (Public Generation Trace)
终版生成会话中可向用户展示并持久化的生成活动状态、公开处理摘要、正文增量、供应商显式返回的推理输出和工具调用记录。模型未返回推理输出时不显示推理区，但生成活动状态始终可见。
_Avoid_: 完整思维链、调试日志

### 生成活动状态 (Generation Activity Status)
一次 AI 生成轮次仍在执行时持续显示的可见状态，即使模型没有返回推理或正文增量，也让用户明确知道生成尚未结束。
_Avoid_: 模型思维链、静态占位文本

### 供应商推理输出 (Provider Reasoning Output)
模型供应商通过协议显式返回、应用可以接收、展示并随会话记录保存的 reasoning 或 thinking 内容。未返回的隐藏内部推理不属于供应商推理输出，应用不会推测或伪造它。
_Avoid_: 完整思维链、公开处理摘要

### 推理强度 (Reasoning Effort)
终版生成会话中控制支持 reasoning 的模型投入程度的用户选择，包含自动、低、中、高四档。每个生成轮次记录实际模型和推理强度，不支持 reasoning 的模型不显示该选择。
_Avoid_: AI 风格、temperature

### 模型能力 (Model Capability)
当前 AI 协议和模型经应用确认可用的流式正文、供应商推理输出、工具调用和推理强度等能力。未知兼容模型只声明已经验证的能力，不根据名称推测。
_Avoid_: 模型品牌、理论支持能力

### 有效系统提示词 (Effective System Prompt)
一次终版生成会话实际采用的应用级生成指令、AI 风格指令和工具规则的只读快照。供应商未向应用公开的内部指令不属于有效系统提示词。
_Avoid_: 拼接后的完整用户上下文、供应商隐藏提示词

### 生成预览 (Generation Preview)
AI 在终版生成会话中通过终版提案工具提交、但尚未替换当前终版的只读候选内容。每次工具调用均保留在会话记录中，最新一次默认为当前预览；用户在对话区域外评审和确认后才成为当前终版。
_Avoid_: 自动保存生成结果、临时视图

### 提案评审 (Proposal Review)
用户在生成对话区域外通过渲染预览、Markdown 源码和差异对比检查当前生成预览，并决定是否采用的过程。生成预览在评审中保持只读，修改通过追加对话指令完成。
_Avoid_: 对话内确认、候选稿编辑器

### 已采用提案 (Accepted Proposal)
用户通过提案评审确认并保存为当前终版的生成预览。采用动作保留对生成会话和工具调用的引用，并将新终版设为该会话后续轮次的编辑基线。
_Avoid_: 自动生成终版、已完成会话

### 无生成记录终版 (Untraced Final Report)
在终版生成会话启用前已经存在、没有会话或提案来源记录的终版。系统不为其伪造历史；下一场真实会话可以把它作为编辑基线。
_Avoid_: 迁移生成会话、来源丢失终版

### 终版提案工具 (Final Report Proposal Tool)
AI 用于向应用提交一份完整生成预览的会话工具。每个 AI 轮次最多调用一次；工具调用只产生候选终版及变更摘要，不直接修改当前终版或触发评分。
_Avoid_: 保存终版工具、自动落盘

### 生成轮次 (Generation Turn)
终版生成会话中由一条用户消息触发、以 AI 回复完成、失败或被停止结束的一次交互。被停止或断线的轮次保留已经收到的公开过程记录，但不完整的工具调用不会产生生成预览。
_Avoid_: 整场生成会话、单个文本片段

### 会话记录 (Generation Transcript)
终版生成会话中按发生顺序追加保存的系统消息、用户消息、AI 可见输出、公开过程记录和工具调用。既有记录不原地编辑；纠正通过追加消息表达。
_Avoid_: 可编辑聊天文档、临时日志

### 会话上下文上限 (Session Context Limit)
终版生成会话在不压缩历史的前提下可继续发送给模型的最大上下文边界。接近边界时停止新增轮次，用户从当前终版开启新会话。
_Avoid_: 自动历史摘要、供应商错误上限

### 会话归档 (Session Archive)
终版生成会话退出日常活动列表但仍保留记录和提案引用的状态。已被终版引用的会话只能归档，不能物理删除其最小审计记录。
_Avoid_: 删除终版来源、结束生成轮次

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
