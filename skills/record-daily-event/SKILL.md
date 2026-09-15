---
name: record-daily-event
description: Query, create, update, and delete events on the weekly-reporter timeline. Use this skill whenever the user wants to log work, check what happened on a date, edit a past event, mark something important, remove a wrong entry, or interact with the timeline in any way — even if they don't say "timeline" or "event". Triggers on phrases like "log this", "what did I do on Tuesday", "change that event", "mark as important", "delete #123", "show this week's events", or any reference to daily work history.
---

Manage timeline events via four Node.js scripts. All scripts use built-in `fetch` (Node 18+) and read `WEEKLY_REPORTER_URL` from env (defaults to `http://localhost:6868`).

Content passed to create/update must be single-line plain text. Replace newlines with spaces before passing.

## Query

List events with optional filters. Output is one event per line with id, time, source, importance marker (★), content, and tags.

```bash
node {baseDir}/scripts/query.mjs [--date <YYYY-MM-DD>] [--week-start <YYYY-MM-DD>] [--week-end <YYYY-MM-DD>] [--tags <tag1,tag2>] [--source <manual|auto>] [--limit <n>]
```

- `--date` — single day (e.g. `2026-09-15`)
- `--week-start` + `--week-end` — date range
- `--tags` — comma-separated tag filter (overrides date/week filters)
- `--source` — `manual` or `auto`
- `--limit` — max results (default 50, max 200)

No flags = latest 50 events. The last line shows count and pagination cursor if `hasMore` is true.

## Create

Add a new work entry. Preview the content to the user and get approval before running.

```bash
node {baseDir}/scripts/post.mjs "<content>" [--time <ISO8601-timestamp>]
```

- `--time` — optional; defaults to now. Use when the user specifies when the work happened.
- On success: `✓ Event created: #<ID>`

## Update

Modify an existing event. At least one flag is required.

```bash
node {baseDir}/scripts/update.mjs <id> [--content <text>] [--time <ISO8601>] [--important <true|false>]
```

- `--content` — replace event text
- `--time` — change event timestamp
- `--important` — toggle the ★ importance flag
- On success: `✓ Event #<id> updated`

## Delete

Remove a manually-created event. Auto-collected events cannot be deleted.

```bash
node {baseDir}/scripts/delete.mjs <id>
```

- Confirm with the user before deleting.
- On success: `✓ Event #<id> deleted`
- On 403: event is auto-collected and cannot be deleted.

## Error handling

All scripts exit 0 on success, non-zero on failure. Common errors:

| Message | Cause | Fix |
|---|---|---|
| `Cannot reach weekly-reporter` | Server not running | Start with `npm run dev` |
| `Invalid request (HTTP 4xx)` | Bad input | Check the error detail and retry |
| `Server error (HTTP 5xx)` | Backend issue | Check server logs |
