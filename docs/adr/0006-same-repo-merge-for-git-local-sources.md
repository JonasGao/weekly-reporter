# Same-Repo Merge for Git-Local Collection Sources

Git-local collection sources change from "one path + branch name list" to "repo identity + collection path list": `config.paths[]` (with `path`, `lastBranch`, `lastCommitTime`), `owner` kept as the primary path. Scanning or adding a directory whose normalized origin URL matches an existing source no longer creates a new source — the directory is appended as a collection path of that source. This natively supports git worktrees and multiple clones of the same repo.

**Status**: accepted

**Considered Options**:
- Repo identity: normalized origin URL (chosen) vs worktree common-dir detection + origin vs any remote. No-origin local repos never merge.
- Model: `paths[]` replacing `branches[]` for git-local (chosen) vs adding `path` to branch entries vs branches and paths coexisting. Remote source types keep `branches[]`.
- Branch semantics per path: follow the checked-out branch at sync time (chosen) vs locked branch name recorded at add time vs both.
- Same branch checked out at multiple paths: allowed, each path collects independently with its own cursor (chosen) vs treated as already covered.
- Cursor on branch switch: reset to empty and rescan the new branch, sha dedup as backstop (chosen) vs never reset vs reset at merge-base.
- Failed path during sync (deleted worktree etc.): skip that path with a warning, mark source `unavailable` only when all paths fail (chosen) vs mark whole source unavailable vs auto-remove failed paths.
- Existing duplicate same-remote sources in the database: not migrated (chosen) vs one-time merge script.
- Old config data: runtime normalization when reading (chosen, same pattern as `normalizeBranches`) vs schema migration.

**Consequences**:
- Scanner must recognize `.git` files (worktrees) in addition to `.git` directories.
- Scan dialog shows same-repo directories as selectable with a "will merge into: <source>" label; adding inherits the existing source's `authorEmails` and starts with an empty cursor (full history of the checked-out branch).
- CollectSourceForm for git-local manages a path list instead of a branches input; manual path entry runs the same same-repo detection.
- Events from the same sha visible at multiple paths are deduplicated by existing sourceId + sha logic.
- Historical events and existing standalone sources are untouched; merging applies to new additions only.
