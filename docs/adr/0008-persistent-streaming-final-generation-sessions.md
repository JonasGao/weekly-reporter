---
status: accepted
---

# Use application-owned streaming sessions for final report generation

Replace one-shot final generation with persistent, multi-turn generation sessions owned by the application. A session is fixed to one report audience, source revision, template snapshot, style snapshot, and effective system-prompt snapshot; each turn uses the currently configured model and records the actual protocol, model, reasoning effort, visible provider reasoning, text, status, and tool activity. The server streams AI SDK message parts plus honest application activity states, while the transcript shows the exact application-level system instructions and only a deterministic overview of the full source draft that the model receives.

AI may discuss and revise freely, but only one `propose_final_report` tool call per turn can create a complete, read-only generation preview. The tool never writes the current final. Users review the latest proposal outside the conversation through rendered Markdown, source, and diff views; acceptance transactionally updates the audience final, records the accepted proposal and system event, and then triggers asynchronous scoring. The conversation remains open for further revisions after acceptance.

The application database is the session system of record rather than provider conversation state. Sessions, turns, message parts, and proposals are stored separately; streamed chunks are coalesced before periodic persistence. Provider reasoning is shown and retained only when explicitly returned, while a visible Working state is always present. History is not compacted initially: approaching the context limit requires starting a new session from the current final. Existing finals are not assigned fabricated generation histories, and the old one-shot generation route remains only as a temporary rollback path during migration.

## Considered Options

- One-shot structured generation versus persistent multi-turn streaming sessions (chosen)
- Provider-owned conversation state versus an application-owned transcript (chosen)
- Direct AI writes versus a proposal tool followed by external user confirmation (chosen)
- Full source drafts in the transcript versus deterministic source overviews with full model context (chosen)
- Requiring reasoning versus displaying provider reasoning only when available (chosen)
- A single transcript JSON blob versus normalized sessions, turns, message parts, and proposals (chosen)
- Automatic history compaction versus an explicit context limit and new session (chosen initially)

## Consequences

- Edit pages gain session selection, streaming chat, capability indicators, context inspection, and an external proposal-review panel; view pages expose transcripts read-only.
- Protocol adapters must normalize OpenAI Responses reasoning, Anthropic thinking, and explicitly supported OpenAI-compatible reasoning formats such as the configured GLM integration.
- The system prompt and proposal-tool contract become user-visible session snapshots, while provider-hidden instructions remain outside the product contract.
- Proposal acceptance must validate the current source revision and commit final content, proposal linkage, transcript event, and editing baseline atomically.
- Long reasoning and message streams increase SQLite storage and require bounded output, coalesced writes, stop handling, and recovery of incomplete turns.
