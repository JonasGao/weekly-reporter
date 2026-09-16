#!/usr/bin/env node

// Rebuild both source drafts of a report from the current events.
// Usage: regenerate-source.mjs <id>

import { api, failResponse, parseArgs, requireId } from './lib/client.mjs'

const USAGE = 'Usage: regenerate-source.mjs <id>'

const { positional } = parseArgs(process.argv.slice(2), {}, USAGE)
const reportId = requireId(positional[0], USAGE)

const { status, body } = await api(`/api/reports/${reportId}/regenerate-source`, { method: 'POST' })
if (status !== 200) failResponse(status, body, `Report #${reportId}`)

console.log(`✓ Source drafts regenerated for report #${reportId} — ${(body.snapshots ?? []).length} snapshot event(s)`)
for (const variant of body.variants ?? []) {
  const stale = variant.finalStatus === 'stale'
  console.log(`  ${variant.variant}: rev ${variant.sourceRevision}, ${(variant.sourceDraft ?? '').length} chars, final ${variant.finalStatus ?? 'none'}`)
  if (stale) {
    // Regenerating deliberately marks an adopted final stale — it is still shown
    // in the app, but it no longer reflects the draft it was built from.
    console.log(`    ↳ the adopted ${variant.variant} final is now stale; regenerate it before sending the report out`)
  }
}
