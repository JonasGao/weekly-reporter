# 同步游标使用 committer date，per-branch 独立维护

采集源的同步起始时间（`since`）从「上次同步操作时间 (`lastSyncAt`)」改为「上次同步拿到的 commit 中最大的 committer date」，每个分支独立维护。

## 背景

原先以 `lastSyncAt`（同步操作的墙钟时间）作为下次 sync 的 `since`。存在时间缝隙问题：同步发生在 T=10:00，但最后一个 commit 的 committer date 是 09:55。若在 09:55~10:00 之间有 commit 被延迟推送（如 amend/rebase 后 push），下次 sync 从 10:00 开始会漏掉它。

## 决策

1. **Cursor 语义**：每个分支上次同步拉到的 commit 中最大的 committer date
2. **存储位置**：`config.branches[i].lastCommitTime`，不加 source 级字段
3. **分支格式迁移**：`config.branches` 从 `string[]` 改为 `{ name, lastCommitTime }[]`，读兼容旧格式（读到 string 时当作 `{ name: str, lastCommitTime: null }`）
4. **更新规则**：
   - 同步成功且拉到新 commit → 更新对应 branch 的 cursor
   - 拉到 0 个 commit 或同步失败 → 不更新
   - resync 结束后也更新 cursor（让后续 normal sync 受益）
5. **首次同步**：cursor 为 null → `since = undefined`（全量拉取）
6. **eventTime 不变**：继续用 author date（面向用户的工作时间语义）

## 为什么用 committer date 而非 author date

- GitHub/GitLab/local git 的 `since` 参数都按 committer date 过滤
- Author date 在 amend/rebase 时不变，会导致 cursor 停滞（反复拉同一个时间窗口）
- Committer date 反映 commit 实际进入仓库的时间，与 API 语义对齐

## 为什么 per-branch 而非 source 级单 cursor

多分支场景下，不同分支的 commit 时间线可能差异很大。单 cursor（取 max）会让落后分支漏数据；取 min 会让领先分支反复拉取。Per-branch cursor 让每个分支独立推进，既不漏数据也不浪费。

## UI

在采集源列表的 `lastSyncAt`（「5分钟前」）旁，小字显示「同步至：{max(lastCommitTime across branches)}」，方便排查 cursor 停滞问题。
