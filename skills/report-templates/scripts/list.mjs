#!/usr/bin/env node

// List weekly-report templates, official and user, with their selection IDs.
// Usage: list.mjs [--kind <official|user|all>] [--query <text>]

import { fetchAll, firstLine, parseArgs } from './lib/client.mjs'

const USAGE = 'Usage: list.mjs [--kind <official|user|all>] [--query <text>]'

const { flags } = parseArgs(process.argv.slice(2), {
  '--kind': 'value',
  '--query': 'value',
}, USAGE)

const kind = flags.kind ?? 'all'
if (!['official', 'user', 'all'].includes(kind)) {
  console.error(`Error: --kind must be official, user or all (got '${kind}')`)
  process.exit(1)
}

const { official, user } = await fetchAll()
const needle = flags.query?.toLowerCase()

// Searching name + content + tags + description matches what a caller means by
// "the template that mentions 风险" — they rarely remember which field it was in.
function matches(template) {
  if (!needle) return true
  return [template.name, template.content, template.tags, template.description]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(needle))
}

function print(label, rows) {
  console.log(`── ${label} (${rows.length}) ──`)
  if (rows.length === 0) {
    console.log('  (none)')
    return
  }
  for (const template of rows) {
    // The selection ID is what /api/reports/[id]/generate and the generation
    // sessions endpoint expect, so it's the field worth putting first.
    console.log(`  ${template.selectionId.padEnd(24)} ${template.name}`)
    const meta = [`style: ${template.aiStyle}`, `${template.content.length} chars`]
    if (template.tags) meta.push(`tags: ${template.tags}`)
    if (template.sourceTemplateId) meta.push(`cloned from ${template.sourceTemplateId}`)
    console.log(`  ${' '.repeat(24)} ${meta.join('   ')}`)
    console.log(`  ${' '.repeat(24)} ${firstLine(template.content) || '(empty)'}`)
  }
}

const officialRows = official.filter(matches)
const userRows = user.filter(matches)

if (kind === 'all' || kind === 'official') print('official (read-only, clone to edit)', officialRows)
if (kind === 'all') console.log('')
if (kind === 'all' || kind === 'user') print('user (editable)', userRows)

if (needle && officialRows.length + userRows.length === 0) {
  console.log(`\nNothing matched '${flags.query}'.`)
}
