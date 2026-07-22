# Extract Hardcoded Prompts into Database-Driven Management System

Move all AI prompt texts from hardcoded TypeScript constants into database tables with a management UI at `/prompts`, mirroring the existing `/templates` pattern.

**Status**: accepted

**Considered Options**:
- Scope: all prompts (chosen) vs style-only vs style + check/score separately
- Style lifecycle: full CRUD (chosen) vs fixed 4 with edit-only
- Style key: user-provided with random word default (chosen) vs auto slug from label vs UUID
- Delete strategy for reports: clear `aiStyleOverride` to NULL (chosen) vs cascade to default vs prevent
- Delete strategy for templates: read-time fallback to default (chosen) vs write-time UPDATE vs prevent
- Default style: `is_default` flag, exactly one, last one undeletable (chosen) vs hardcoded "formal" key
- Field granularity: all editable, basic/advanced two-tier UI (chosen) vs lock temperature/weights
- check/score prompts: global singleton, edit-only (chosen) vs multi-instance CRUD
- Variable syntax: `{{variable}}` with hint row (chosen) vs `${variable}` vs no variables
- Reset: "restore default" button (chosen) vs no reset
- UI location: `/prompts` independent page with two tabs (chosen) vs settings dialog vs inline in templates
- Storage: two separate tables `ai_styles` + `system_prompts` (chosen) vs single polymorphic table
- Runtime reads: direct DB read, no cache (chosen) vs memory cache with write-through
- `AIStyle` type: union type → `string` (chosen) vs branded string type

**Consequences**:
- Two new drizzle tables: `ai_styles` (CRUD) and `system_prompts` (singleton edit)
- Migration needed to create both tables and seed 4 built-in styles + 2 system prompts
- `src/lib/ai/styles.ts` `aiStyles` object deprecated, `getAIStyle()` becomes async DB read
- `src/lib/ai.ts` `checkContent` / `scoreReport` read from `system_prompts` table
- `src/lib/db/schema.ts` `AIStyle` type changes from union to `string`
- New `/prompts` page with style management (list + create/edit/delete) and system prompt editing
- Template `aiStyle` column: invalid keys fall back to default at read time (no data migration)
- Report `aiStyleOverride` column: cleared when referenced style is deleted
- Key validation: unique, `[a-z][a-z0-9_-]*` pattern, random English word as default
