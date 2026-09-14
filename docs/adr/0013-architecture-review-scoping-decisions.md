---
status: accepted
---
# Architecture review scoping decisions (2026-09-14)

A deepening pass on the largest, most-touched files proposed seven refactors (all accepted and landed). Three candidates were scoped down on closer reading; these decisions are recorded so future architecture reviews don't re-suggest the same work without the context that led to the reduction.

## Generation contract files are a shared-types seam, not a pass-through

`src/lib/generation/report-list-contract.ts` and `report-content-contract.ts` hold types, type guards, boundary constants, and (historically) a context-assembler. They are imported across six files (`public-summary`, `stream`, `context`, `service`, `report-list-tool`, `GenerationWorkspace`). The review initially flagged them as pass-through abstractions to merge into their `*-tool.ts` siblings, but the deletion test fails: deleting a contract file only MOVES the shared types (they must live somewhere shared), and merging would make non-tool code depend on the tool module — relocating the shared hub and worsening locality. The one stranded piece, `buildHistoricalReportListContext`, moved to `context.ts` next to its peer builders (ADR-0008). The contract files stay as the shared-types seam.

## Default prompt text in lib/ai.ts and PromptManager.tsx are distinct, not duplicates

`lib/ai.ts` `getSystemPrompt` hardcodes Chinese fallbacks for `check` and `generate` (server-side, used when no DB row exists). `PromptManager.tsx` `SystemPromptTab` defines English seed consts `DEFAULT_CHECK` and `DEFAULT_SCORE` for UI creation. These are different languages and different key sets (`generate` vs `score`); they are not two copies of one constant. The review proposed unifying them as a single source — unifying requires a canonical-language product decision (Chinese server fallback vs English UI seed) and is not a behavioral-preserving refactor. Leave them separate until that decision is made.

## TurnExecution / runTurn extraction from stream.ts is deferred

The deeper extraction of `createGenerationEventStream`'s ~330-line closure into a `TurnExecution` module owning the `activeTurnControllers` map and a `runTurn` entry point was deferred. The streaming test covers only reasoning/text/finish deltas; the tool-call, tool-result, and proposal streaming paths have no test coverage, so a behavior-preserving extraction of the loop could not be verified against a regression net. The tool registry was extracted as `createGenerationTools` (a testable, injectable factory) as the safe first step. Re-open the full `TurnExecution` extraction only after adding tests for the tool/proposal streaming paths.

## Consequences

- The contract/tool file split is preserved; future reviews should not propose merging `*-contract.ts` into `*-tool.ts`.
- Prompt default text remains in two places pending a canonical-language product decision.
- `stream.ts` retains its streaming closure and the module-global `activeTurnControllers`; the `runTurn` extraction is pending test coverage of the tool/proposal paths.
