#!/usr/bin/env node

// Create a weekly report and its two audience source drafts from event snapshots.
// Usage: create.mjs --title <text> --start <YYYY-MM-DD> --end <YYYY-MM-DD>

import { api, failResponse, json, parseArgs, requireDate } from './lib/client.mjs'

const USAGE = 'Usage: create.mjs --title <text> --start <YYYY-MM-DD> --end <YYYY-MM-DD>'

const { flags } = parseArgs(process.argv.slice(2), {
  '--title': 'value',
  '--start': 'value',
  '--end': 'value',
}, USAGE)

if (!flags.title || !flags.title.trim()) {
  console.error('Error: --title is required')
  console.error(USAGE)
  process.exit(1)
}

const payload = {
  title: flags.title.trim(),
  weekStart: requireDate(flags.start, '--start'),
  weekEnd: requireDate(flags.end, '--end'),
}

const { status, body } = await api('/api/reports', json(payload))
if (status !== 201 && status !== 200) failResponse(status, body, 'Report')

const report = body.report ?? body
console.log(`✓ Report created: #${report.id} — ${report.title} (${report.weekStart} ~ ${report.weekEnd})`)
console.log(`  Snapshot events: ${(body.snapshots ?? []).length}`)
for (const variant of body.variants ?? []) {
  const draft = variant.sourceDraft ?? ''
  const empty = draft.length === 0 || /本周暂无事件|No events this week/.test(draft)
  // An empty source draft saves fine but cannot produce a final, so say so now
  // rather than letting the next step fail confusingly.
  console.log(`  ${variant.variant}: source draft ${draft.length} chars${empty ? ' (EMPTY — no final can be generated from it)' : ''}`)
}
