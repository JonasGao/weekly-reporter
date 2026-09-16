#!/usr/bin/env node

// Preview the source drafts a date range would produce, without creating a report.
// Usage: preview.mjs --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--variant <leadership|personal>] [--full]

import { api, failResponse, json, parseArgs, requireDate, requireVariant } from './lib/client.mjs'

const USAGE = 'Usage: preview.mjs --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--variant <leadership|personal>] [--full]'

const { flags } = parseArgs(process.argv.slice(2), {
  '--start': 'value',
  '--end': 'value',
  '--variant': 'value',
  '--full': 'boolean',
}, USAGE)

const weekStart = requireDate(flags.start, '--start')
const weekEnd = requireDate(flags.end, '--end')
const variantFilter = flags.variant ? requireVariant(flags.variant) : null

const { status, body } = await api('/api/reports/preview', json({ weekStart, weekEnd }))
if (status !== 200) failResponse(status, body, 'Preview')

const variants = (body.variants ?? []).filter((variant) => !variantFilter || variant.variant === variantFilter)

for (const variant of variants) {
  const draft = variant.sourceDraft ?? ''
  const lines = draft.split('\n').filter(Boolean)
  console.log(`── ${variant.variant} ── ${lines.length} line(s), ${draft.length} chars`)
  if (flags.full) {
    console.log(draft || '(empty)')
  } else {
    // Head-only by default: a full draft can run thousands of characters, and the
    // usual question is just "does this range have the right events in it?".
    console.log(lines.slice(0, 12).join('\n') || '(empty)')
    if (lines.length > 12) console.log(`... ${lines.length - 12} more line(s) — rerun with --full`)
  }
  console.log('')
}
