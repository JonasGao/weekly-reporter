---
name: write-event
description: Write events to the weekly-reporter timeline. Use this skill when the user wants to log work, record activities, or write timeline entries - whether they provide explicit text ("log 'fixed bug X'") or ask you to generate content ("summarize my commits today", "write an event about what we just discussed"). This is for capturing work events, not for reading or querying the timeline.
compatibility: |
  ⚠️ No authentication currently implemented. Assumes local API is trusted. Do not use with exposed instances.
---

# Write Event

This skill logs events to the weekly-reporter timeline. Supports direct text or AI-generated content from commits/conversation/files. All content requires user confirmation before sending.

## Workflow

### Parse instruction

- **Quoted text**: `"Fixed auth bug"` → use exact text
- **Generation request**: `summarize commits`, `log what we discussed` → generate from context
- **No instruction**: Ask "What event should I log?"

### Generate content (if requested)

Choose context based on the instruction:
- Git mentions (commits, PRs, code changes) → `git log --since=<timeframe>` or `git diff`
- Conversation references → use recent discussion
- File/feature mentions → read those files

Generate concise content (1-2 sentences ideal):
- Factual and specific
- Action-oriented (what was done, not plans)

Infer timestamp when implied: "yesterday", "this morning", "last week" → use appropriate date. Otherwise use current time.

### Confirm and iterate

Present for approval:
```
Ready to log:
---
[content]
---
Time: [timestamp or "now"]

Ready to send? (or ask me to refine)
```

User can approve ("yes", "send"), request changes ("make it shorter", "add X", "use yesterday"), or cancel. Apply changes and re-present until approved.

```bash
bash {baseDir}/scripts/post-event.sh "<content>" [--time <ISO8601-timestamp>]
```

On success: `✓ Event created: #<ID>`

On failure, suggest fixes: server not running (`npm run dev`), wrong URL, or show error and offer retry.

## Configuration

Script reads `WEEKLY_REPORTER_URL` env var (default: `http://localhost:3000`). Override: `export WEEKLY_REPORTER_URL=http://localhost:8080`

## Examples

**Direct text:**
```
User: /write-event "Fixed auth bug in user service"
You: Ready to log:
     ---
     Fixed auth bug in user service
     ---
     Time: now
     Ready to send?
User: yes
You: ✓ Event created: #123
```

**Generate from commits:**
```
User: /write-event summarize my commits today
You: Ready to log:
     ---
     Implemented JWT auth and fixed token storage
     ---
     Time: now
     Ready to send?
User: good
You: ✓ Event created: #124
```
