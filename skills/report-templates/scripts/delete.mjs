#!/usr/bin/env node

// Delete a user template.
// Usage: delete.mjs <ref> --confirm

import { api, fail, failResponse, firstLine, parseArgs, requireUserTemplate, resolveRef } from './lib/client.mjs'

const USAGE = 'Usage: delete.mjs <ref> --confirm'

const { flags, positional } = parseArgs(process.argv.slice(2), { '--confirm': 'boolean' }, USAGE)

const template = requireUserTemplate(await resolveRef(positional[0], USAGE), 'deleted')

// Nothing restores a deleted template, and name resolution means the caller may
// not have looked at what they matched — so show it before requiring --confirm.
if (!flags.confirm) {
  console.error('Refusing to delete without --confirm.')
  console.error(`  ${template.selectionId}  ${template.name}`)
  console.error(`  ${template.content.length} chars, style ${template.aiStyle}`)
  console.error(`  ${firstLine(template.content, 60) || '(empty)'}`)
  console.error('  Reports already generated from it keep their own template snapshot and are unaffected.')
  fail(`Rerun: delete.mjs ${template.selectionId} --confirm`)
}

const { status, body } = await api(template.apiPath, { method: 'DELETE' })
if (status !== 200) failResponse(status, body, template.selectionId)

console.log(`✓ Deleted ${template.selectionId} "${template.name}"`)
