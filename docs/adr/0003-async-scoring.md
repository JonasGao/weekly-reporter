# 0003. Async Scoring for Weekly Reports

## Status

Accepted

## Context

The current weekly report system requires users to wait for AI scoring before saving. This creates a poor user experience because:

1. AI scoring is slow (3-5 seconds)
2. Users are blocked from saving until scoring completes
3. Users cannot save drafts without going through scoring
4. The ScorePanel acts as a mandatory gatekeeper

Users want to save quickly and see scores later, rather than waiting for the scoring process to complete.

## Decision

We will implement **asynchronous scoring** with the following architecture:

### 1. Save Flow Changes

- **Remove ScorePanel entirely** from new/edit pages
- User clicks "保存" → Report saves immediately
- Async scoring triggers in background
- User sees success message and returns to report list

### 2. Database Schema

Add scoring fields to `reports` table (no JSON, separate columns):

```typescript
scoreStatus: text('score_status').$type<ScoreStatus>().default('pending').notNull(),
scoreStructure: integer('score_structure'),
scoreContent: integer('score_content'),
scoreValue: integer('score_value'),
scoreOverall: integer('score_overall'),
suggestions: text('suggestions'), // newline-separated
scoreError: text('score_error'),
scoredAt: integer('scored_at', { mode: 'timestamp' })
```

### 3. Score Lifecycle

Four states:
- `pending`: Saved, waiting for scoring
- `scoring`: AI is processing
- `completed`: Score available
- `failed`: Scoring failed (with error message)

### 4. Recalculation Strategy

- Only recalculate if `content` field changes
- Server-side comparison (compare old vs new content)
- Reset score fields when content changes
- Use report's `aiStyleOverride` if set, otherwise default style

### 5. Concurrency Control

- If `scoreStatus === 'scoring'`, don't trigger new scoring
- Prevent multiple simultaneous scoring processes for same report
- Last save wins in multi-tab scenario

### 6. Real-time Updates with SSE

- Server-Sent Events endpoint: `GET /api/reports/score-stream`
- Broadcast all score updates to connected clients
- In-memory subscriber Map (single-user app)
- Client filters by reportId

### 7. Error Handling

- Store user-friendly error messages in `scoreError`
- Manual retry via `POST /api/reports/[id]/rescore`
- Unlimited retries
- Specific errors: API key missing, timeout, rate limit, network failure

### 8. UI Changes

**Report List:**
- Badge on right side: "85分 ✓" (completed), "评分中..." (scoring), "待评分" (pending), "评分失败 ↻" (failed with retry)
- Click badge to see detailed breakdown (optional)

**Report Detail Page:**
- Score card showing breakdown: structure, content, value, overall
- Suggestions list
- Scoring timestamp: "评分时间: 2026-07-21 14:30"
- Spinner for pending/scoring states

### 9. API Changes

**Modified:**
- `POST /api/reports` - Trigger async scoring after save
- `PUT /api/reports/[id]` - Conditional rescoring on content change

**New:**
- `POST /api/reports/[id]/score-internal` - Async scoring endpoint
- `POST /api/reports/[id]/rescore` - Manual retry for failed scoring
- `GET /api/reports/score-stream` - SSE endpoint for real-time updates

## Consequences

### Positive

1. **Better UX**: Users save immediately without waiting
2. **Non-blocking**: No mandatory scoring step
3. **Real-time feedback**: SSE shows score updates instantly
4. **Reliable**: Failed scoring doesn't block saving
5. **Efficient**: Only recalculate when content changes

### Negative

1. **Complexity**: More moving parts (SSE, async processing)
2. **Connection management**: Need to handle SSE lifecycle
3. **Stale scores**: Score might not match content if user edits before scoring completes
4. **Error handling**: More error states to handle

### Risks

1. **SSE connection drops**: Score updates might be missed
   - Mitigation: Client reconnects on connection close
   
2. **AI service failure**: All reports stuck in 'scoring' state
   - Mitigation: Manual retry button, clear error message

3. **Race conditions**: Rapid edits might cause confusion
   - Mitigation: Check status before triggering new scoring

## Alternatives Considered

### 1. Polling instead of SSE

Rejected because:
- Wasteful (many empty requests)
- Latency (polling interval)
- Less responsive user experience

### 2. JSON fields for scores

Rejected because:
- User explicitly requested: "do not use json as much as possible"
- Separate columns are more explicit and queryable

### 3. Automatic retry on failure

Rejected because:
- Might hammer failing AI service
- User explicitly triggering retry is more predictable
- Simplifies implementation

### 4. Keep ScorePanel as optional preview

Rejected because:
- CheckPanel already provides real-time suggestions
- Extra UI complexity without clear benefit
- Scores appear in list anyway

## Implementation Notes

### Database Migration

```sql
ALTER TABLE reports ADD COLUMN score_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN score_structure INTEGER;
ALTER TABLE reports ADD COLUMN score_content INTEGER;
ALTER TABLE reports ADD COLUMN score_value INTEGER;
ALTER TABLE reports ADD COLUMN score_overall INTEGER;
ALTER TABLE reports ADD COLUMN suggestions TEXT;
ALTER TABLE reports ADD COLUMN score_error TEXT;
ALTER TABLE reports ADD COLUMN scored_at INTEGER;

-- Mark existing reports as pending for async scoring
UPDATE reports SET score_status = 'pending' WHERE score_status IS NULL;
```

### SSE Implementation

```typescript
// Global subscriber registry
const subscribers = new Map<string, Set<(update: ScoreUpdate) => void>>()

function broadcastScoreUpdate(update: ScoreUpdate) {
  subscribers.forEach(callback => callback(update))
}

// Client-side
useEffect(() => {
  const eventSource = new EventSource('/api/reports/score-stream')
  
  eventSource.onmessage = (event) => {
    const update = JSON.parse(event.data)
    // Update local state
  }
  
  return () => eventSource.close()
}, [])
```

### Content Change Detection

```typescript
const oldReport = await db.reports.findById(id)
const contentChanged = oldReport.content !== content

if (contentChanged) {
  await db.reports.update(id, {
    content,
    scoreStatus: 'pending',
    scoreStructure: null,
    scoreContent: null,
    scoreValue: null,
    scoreOverall: null,
    suggestions: null,
    scoreError: null,
    scoredAt: null
  })
  
  triggerAsyncScoring(id)
}
```

## References

- Domain model: `/CONTEXT.md` - "周报评分" section
- Related ADR: 0001-sync-cursor-committer-date (async data fetching)
- Implementation: `/src/lib/ai.ts` - `scoreReport()` function