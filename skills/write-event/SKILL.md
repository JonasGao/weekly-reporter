---
name: write-event
description: Write events to the weekly-reporter timeline. Use this skill when the user wants to log work, record activities, or write timeline entries - whether they provide explicit text ("log 'fixed bug X'") or ask you to generate content ("summarize my commits today", "write an event about what we just discussed"). This is for capturing work events, not for reading or querying the timeline.
---

# Write Event

This skill helps users write events to their weekly-reporter timeline. It supports two modes:
1. **Direct text**: User provides exact content to log
2. **AI-generated**: User asks you to create content based on context (commits, conversation, files)

**Important**: All content must be confirmed by the user before sending to the API.

## Workflow

When the user invokes `/write-event`:

### Step 1: Parse the instruction

Determine what the user wants:

- **Direct text with quotes**: `"Fixed authentication bug"` → they want this exact text
- **Generation request**: `summarize my commits today`, `log what we just discussed` → you need to generate content
- **No instruction**: Ask "What event should I log?"

### Step 2: Generate content (if needed)

If the user asked for generated content:

1. **Determine what context you need** based on their instruction:
   - Mentions commits, PRs, git, code changes → `git log --since=<timeframe>` or `git diff`
   - Mentions "we discussed", "conversation", "talked about" → use recent conversation context
   - Mentions specific files or features → read those files
   - Ambiguous → use your best judgment on what context is most relevant

2. **Generate the event content** that captures the key information concisely. Event content should be:
   - Concise (1-2 sentences ideal, 3 max)
   - Factual and specific
   - Action-oriented (what was done, not what will be done)

3. **Infer the timestamp** if the instruction implies a specific time:
   - "yesterday" → use yesterday's date
   - "this morning" → use today's morning time
   - "last week's work" → use appropriate date from that period
   - Otherwise, default to current time

### Step 3: Show content for confirmation

Present the generated or direct content clearly:

```
Ready to log this event:
---
[content here]
---
Time: [timestamp or "now"]

I can send this, or you can ask me to refine it (e.g., "make it shorter", "add the PR link", "use yesterday's date").
Ready to send?
```

### Step 4: Handle feedback loop

The user can:
- **Approve**: "yes", "send it", "looks good", "ok" → proceed to Step 5
- **Request changes**: "make it shorter", "add X", "change the time to yesterday" → regenerate and return to Step 3
- **Cancel**: "cancel", "never mind" → stop without sending

For change requests:
- Apply the requested modification
- Show the revised content
- Return to the confirmation prompt

Iterate until the user approves.

### Step 5: Send to API

Call the helper script to POST the event:

```bash
bash {baseDir}/scripts/post-event.sh "<content>" [--time <ISO8601-timestamp>]
```

The script will:
- POST to the weekly-reporter API
- Return the event ID on success
- Return a friendly error message on failure

### Step 6: Report result

On success:
```
✓ Event created: #<ID>
```

On failure, show the error and suggest next steps:
- "Server not running" → suggest starting it with `npm run dev`
- "Connection refused" → check if API is at the configured URL
- Other errors → show the message and ask if they want to retry

## Configuration

The helper script reads `WEEKLY_REPORTER_URL` from the environment, defaulting to `http://localhost:3000`.

To use a different URL:
```bash
export WEEKLY_REPORTER_URL=http://localhost:8080
```

Or set it in your shell profile for persistence.

## Examples

**Example 1: Direct text**
```
User: /write-event "Fixed authentication bug in user service"
You: Ready to log this event:
     ---
     Fixed authentication bug in user service
     ---
     Time: now
     
     Ready to send?
User: yes
You: ✓ Event created: #123
```

**Example 2: Generate from commits**
```
User: /write-event summarize my commits today
You: [runs git log --since="today"]
     Ready to log this event:
     ---
     Implemented JWT authentication and fixed session token storage for compliance
     ---
     Time: now
     
     I can send this, or you can ask me to refine it.
     Ready to send?
User: make it shorter
You: Ready to log this event:
     ---
     Implemented JWT authentication and fixed token storage
     ---
     Time: now
     
     Ready to send?
User: good
You: ✓ Event created: #124
```

**Example 3: Generate from conversation with timestamp**
```
User: /write-event log what we did yesterday
You: [reviews recent conversation context]
     Ready to log this event:
     ---
     Designed and implemented timeline event writer skill with AI content generation
     ---
     Time: 2026-09-09 (yesterday)
     
     Ready to send?
User: send
You: ✓ Event created: #125
```

## Security Note

⚠️ **No authentication is currently implemented**. This skill assumes the weekly-reporter API is running locally and is trusted. Do not use with exposed instances without adding authentication.

**Future**: Authentication support is planned via API key header. The helper script includes a placeholder for this.

## Error Handling

If the POST fails, the script will show a friendly error:
- Parse the HTTP status code
- Show clear, actionable messages
- User can fix the issue and re-invoke the skill to retry

## Technical Details

**API Endpoint**: `POST /api/events`
- Required field: `content` (string)
- Optional field: `eventTime` (ISO 8601 timestamp)
- Returns: `{id, content, eventTime, source, ...}`

**Helper Script**: `scripts/post-event.sh`
- Uses `curl` for HTTP requests
- Reads `WEEKLY_REPORTER_URL` env var
- Placeholder for future authentication headers
