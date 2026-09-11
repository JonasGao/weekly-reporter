---
name: record-daily-event
description: Record daily work content into the weekly-reporter timeline.
---

Summarize and create one work entry from the user's request. If the user gives quoted content e.g. "Fixed auth bug", add the raw quoted text to the timeline. When no instruction is given, prompt: "What event should I log?", then build the entry. Preview the event to theuser for confirmation before writing to the timeline; submit only after user approval.

Submit the event via the command below. Content must be single-line plain text.
```bash
bash {baseDir}/scripts/post-event.sh "<content>" [--time <ISO8601-timestamp>]
```

On success: `✓ Event created: #<ID>`
On failure, suggest fixes: server not running, wrong URL, or show error and offer retry.
