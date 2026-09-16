#!/usr/bin/env node

// Show one template: metadata plus its full instruction text.
// Usage: show.mjs <ref> [--part <meta|content|both>]
// <ref> is a selection ID (official-general, user-3), a bare user ID (3), or a name substring.

import { formatDate, parseArgs, resolveRef } from './lib/client.mjs'

const USAGE = 'Usage: show.mjs <ref> [--part <meta|content|both>]'

const { flags, positional } = parseArgs(process.argv.slice(2), { '--part': 'value' }, USAGE)

const part = flags.part ?? 'both'
if (!['meta', 'content', 'both'].includes(part)) {
  console.error(`Error: --part must be meta, content or both (got '${part}')`)
  process.exit(1)
}

const template = await resolveRef(positional[0], USAGE)

if (part === 'meta' || part === 'both') {
  console.log(`${template.selectionId}  ${template.name}`)
  console.log(`kind: ${template.kind}${template.kind === 'official' ? ' (read-only — clone to edit)' : ''}`)
  console.log(`style: ${template.aiStyle}   content: ${template.content.length} chars`)
  console.log(`description: ${template.description ?? '—'}`)
  console.log(`tags: ${template.tags ?? '—'}`)
  if (template.sourceTemplateId) console.log(`cloned from: ${template.sourceTemplateId}`)
  if (template.kind === 'user') {
    console.log(`created: ${formatDate(template.createdAt)}   updated: ${formatDate(template.updatedAt)}`)
  }
}

if (part === 'content' || part === 'both') {
  if (part === 'both') console.log('\n--- content ---')
  console.log(template.content || '(empty)')
}
