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
