#!/usr/bin/env node

// Read one weekly report: metadata, both audience variants, and content.
// Usage: show.mjs <id> [--variant <leadership|personal>] [--part <source|final|both|meta>]

import { api, failResponse, formatDate, parseArgs, requireId, requireVariant } from './lib/client.mjs'

const USAGE = 'Usage: show.mjs <id> [--variant <leadership|personal>] [--part <source|final|both|meta>]'

const { flags, positional } = parseArgs(process.argv.slice(2), {
  '--variant': 'value',
  '--part': 'value',
}, USAGE)

const reportId = requireId(positional[0], USAGE)
const variantFilter = flags.variant ? requireVariant(flags.variant) : null
const part = flags.part ?? 'meta'
if (!['source', 'final', 'both', 'meta'].includes(part)) {
  console.error(`Error: --part must be one of source, final, both, meta (got '${part}')`)
  process.exit(1)
}

const { status, body } = await api(`/api/reports/${reportId}`)
if (status !== 200) failResponse(status, body, `Report #${reportId}`)

const variants = (body.variants ?? []).filter((variant) => !variantFilter || variant.variant === variantFilter)
if (variantFilter && variants.length === 0) {
  console.error(`Error: Report #${reportId} has no '${variantFilter}' variant`)
  process.exit(1)
}

console.log(`#${body.id} ${body.title}`)
console.log(`Week: ${body.weekStart} ~ ${body.weekEnd}`)
console.log(`Updated: ${formatDate(body.updatedAt)}   Snapshot events: ${(body.snapshots ?? []).length}`)

for (const variant of variants) {
  const source = variant.sourceDraft ?? ''
  const final = variant.finalContent ?? ''
  console.log('')
  console.log(`── ${variant.variant} ──`)
  // finalStatus is the load-bearing field: 'stale' means the source draft was
  // regenerated after this final was adopted, so the text below is out of date.
  console.log(`final: ${variant.finalStatus ?? 'none'}${variant.finalStatus === 'stale' ? ' (adopted before the latest source draft — regenerate before reuse)' : ''}`)
  console.log(`template: ${variant.templateName ?? '—'}   style: ${variant.aiStyle ?? '—'}   sourceRevision: ${variant.sourceRevision}`)
  console.log(`source draft: ${source.length} chars   final: ${final.length} chars`)

  if (part === 'source' || part === 'both') {
    console.log('\n--- source draft ---')
    console.log(source || '(empty)')
  }
  if (part === 'final' || part === 'both') {
    console.log('\n--- final ---')
    console.log(final || '(no adopted final)')
  }
}
