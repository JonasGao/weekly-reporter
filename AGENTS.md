<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:commit-rules -->
# Commit Rules

- All commit messages must be written in **English**.
- Follow [Conventional Commits](https://www.conventionalcommits.org/): `type: description`
- Enforced by `commitlint` + `husky` pre-commit hook.
<!-- END:commit-rules -->

## Agent skills

### Issue tracker

GitHub issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
