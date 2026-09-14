---
status: accepted
---
# propose_final_report input-boundary robustness (2026-09-14)

A production AI-chat session (session #5, report #22) surfaced four `propose_final_report` failures. Three were input-boundary defects in the tool's Zod schema; the fourth was an empty-output/reasoning failure downstream of them. This ADR records the fix philosophy and mechanism for the three, and the explicit deferral of the fourth.

## Problem

The `propose_final_report` tool (`src/lib/generation/generation-tools.ts`, extracted from `stream.ts` in the architecture review recorded by ADR-0013) declared three optional plan entry points — `plan` (the nested object), and the legacy flat `planJudgments` / `planItems` arrays — with `.describe()` only on `content` and `summary`. Observed production behavior:

- The model used the legacy flat params in 5 of 7 calls. The system prompt (`FINAL_REPORT_PLAN_RULES`) documents only `plan.judgments` / `plan.items`, but the flat arrays are the shape the model has "seen" and, lacking `.describe()`, nothing in the tool schema steers it toward `plan`.
- Turn 24: `summary` sent as a single string, not `string[]` → `AI_InvalidToolInputError`.
- Turn 15: `publicSummary` sent as a bare `string[]`, not `{ modelHandling: string[] }` → `AI_InvalidToolInputError`.
- Turns 16–18: three consecutive empty outputs from qwen3.7-plus. These were the frontend auto-retry (3×) amplifying the permanent shape error from Turn 15 — same input, same error, three burned turns — followed by model-switch empty output.

## Decision: hybrid-coerce boundary philosophy

The boundary coerces the *shape* of known fields for exactly the shape-mistakes already seen in production, while teaching the canonical shape via `.describe()`. It does **not** generalize to "accept anything." Rationale: the cost of a thrown `AI_InvalidToolInputError` is concrete (it triggered the three empty-output turns), and the observed mistakes are low-ambiguity — `string` → `[string]` and `string[]` → `{ modelHandling: string[] }` are unambiguous, not "maybe the model meant something else." The `.describe()` half stops advertising bad shapes; the coerce half stops the blast radius when the model still gets it wrong.

## Mechanism: zod v4 `z.preprocess` (verified)

Schema-level coercion is required (the AI SDK validates tool input against the Zod schema before `execute`, so an `execute`-level guard alone cannot rescue a rejected input). The idiom is `z.preprocess(coerce, z.array(z.string()))`, which:

- renders to the model as the canonical inner schema `{"type":"array","items":{"type":"string"}}` (verified via `z.toJSONSchema`), so the model is not taught to send a bare string; and
- coerces a bare string to `[string]` at parse time, before `execute` runs.

The union+transform alternatives (`z.union(...).transform(...)` and `.or(z.string().transform(...))`) are **unusable** in a tool schema: zod v4 throws *"Transforms cannot be represented in JSON Schema."* `z.preprocess` is the only viable schema-level coercion idiom in zod v4, and it is clean. `execute` therefore needs no change for the coerced fields — it receives already-canonical values.

## P1: delete the legacy plan params, describe `plan`, switch to `z.strictObject`

The legacy `planJudgments` / `planItems` are an undocumented escape hatch only the model stumbles into — there is no programmatic caller (`createGenerationTools` is wired only into `streamText`), the DB stores the merged `planState` (not raw tool input), and the system prompt already documents only `plan`. Rather than describe the legacy fields as "deprecated fallback," they are **deleted** from the schema, eliminating the source of the model's confusion. `plan` gets a `.describe()` marking it as the preferred entry point. `propose_final_report` switches from non-strict `z.object` to `z.strictObject`, aligning it with the other two tools (`query_report_list`, `query_report_content`) — the original reason for non-strict was tolerating the flat legacy keys, which no longer exist. A stale flat-params attempt now errors honestly (`AI_InvalidToolInputError`) instead of silently degrading to `plan: undefined` and defaulting every carry-forward candidate to `uncertain`. The philosophy stays coherent: coerce *shape* of known fields (lenient on shape) while staying strict on *unknown* keys (two different axes, both intentional).

## P4 deferred

The empty-output/reasoning failure (Turns 16–18) is a separate investigation, not a known fix. The exact string *"No output generated. The model stream ended without a finish chunk."* does not exist in `src/` — it originates in the AI SDK or the frontend, not our stream code. `stream.ts` has **no "reasoning-only, zero-content" guard**, and `maxOutputTokens: 16_000` is a single shared budget between reasoning and content — reasoning can starve content and the stream exits silently. This is a genuine latent bug worth a `/diagnosing-bugs` pass in a different seam (the openai-compatible reasoning SSE transform in `provider.ts` + `stream.ts` finish-chunk handling). It is deferred here. Note: fixing P1–P3 likely removes P4's *trigger* — once `summary`/`publicSummary` coerce, the shape error stops firing and the auto-retry won't engage on it.

## Frontend auto-retry on permanent errors (follow-up)

The frontend retries `AI_InvalidToolInputError` as if transient (3× → burned turns). The coerce fix removes the observed trigger, but the underlying gap — retrying a permanent tool-input error — remains, in the frontend streaming consumer (`GenerationWorkspace` / `useStreamingReveal`), a different seam. It is out of scope for this pass and recorded as a deferred follow-up.

## Consequences

- `propose_final_report` schema: `summary` and `publicSummary` wrapped in `z.preprocess` for the observed shape-mistakes; `planJudgments` / `planItems` deleted; `plan` described; the object switched to `z.strictObject`. `execute` simplified (legacy plan normalization removed).
- The model now sees one canonical plan entry point (`plan`); a flat-params attempt surfaces as an error instead of silently degrading.
- A bare `string` for `summary` and a bare `string[]` for `publicSummary` no longer abort the turn; they coerce. Coercion is deliberately narrow (observed mistakes only); a bare `string` for `publicSummary` is **not** coerced and still errors.
- P4 (empty-output/reasoning) and the frontend auto-retry fix are explicit follow-ups; re-open them via `/diagnosing-bugs` rather than bundling into a tool-schema change.
- Tests: `src/lib/generation/generation-tools.test.ts` (new) pins the canonical visible schema, the coercions, and the legacy-params rejection (TDD red→green).
