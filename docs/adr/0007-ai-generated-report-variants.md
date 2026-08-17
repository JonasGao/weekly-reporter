# Persist source drafts and generate audience-specific final reports with AI

**Status**: accepted

Weekly report creation now materializes immutable event snapshots and deterministic source drafts for both the leadership and personal audience variants, without selecting or interpreting a template. A user later chooses one audience variant, a template, and an AI style; the system sends only that variant's source draft to a database-configured AI generation prompt and stores a user-confirmed final report, including template and style snapshots. This replaces deterministic weekly-report placeholder rendering because arbitrary template structures are more useful than a rigid variable/configuration system, while the source drafts remain a reliable factual fallback when AI is unavailable or fails.

**Considered Options**:
- Persist one content field and derive the other audience at display time vs persist two audience variants (chosen)
- Keep deterministic placeholder rendering vs AI interpretation of template text (chosen)
- Generate during initial creation vs save source drafts first and generate explicitly later (chosen)
- Store only source event IDs vs store IDs plus captured event facts (chosen)
- Replace old finals immediately on source regeneration vs preserve and mark them stale (chosen)
- Score source drafts vs score each audience's final report independently (chosen)

**Consequences**:
- A report owns two audience variants, event snapshots, source drafts, and independent final/score lifecycles.
- Initial creation succeeds without an AI configuration; empty source drafts are retained but cannot be generated into finals.
- Final generation is a foreground, confirm-before-save operation and never sends the other audience variant to the model.
- Template content, template identity, and effective AI style are snapshotted with each final, so later template changes do not alter existing reports.
- Existing single-content reports remain legacy personal finals; the system does not infer missing source or leadership content.
- The old weekly-report variable renderer, view-specific template configuration, and variable toolbar are removed; system-prompt variable substitution for checking and scoring remains.
