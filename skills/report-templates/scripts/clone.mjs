#!/usr/bin/env node

// Copy any template (official or user) into a new editable user template.
// Usage: clone.mjs <ref> [--name <text>] [--content <text> | --file <path>]

import { readFile } from 'node:fs/promises'
import { api, fail, failResponse, json, parseArgs, resolveRef } from './lib/client.mjs'

const USAGE = 'Usage: clone.mjs <ref> [--name <text>] [--content <text> | --file <path>]'

const { flags, positional } = parseArgs(process.argv.slice(2), {
  '--name': 'value',
  '--content': 'value',
  '--file': 'value',
}, USAGE)

const source = await resolveRef(positional[0], USAGE)

if (flags.content != null && flags.file != null) {
  fail('Error: provide at most one of --content or --file', USAGE)
}

let content = flags.content
if (flags.file != null) {
  try {
    content = await readFile(flags.file, 'utf8')
  } catch (error) {
    fail(`Error: cannot read --file '${flags.file}': ${error.message}`)
  }
}

if (flags.name && flags.name.length > 100) {
  fail(`Error: --name must be at most 100 characters (got ${flags.name.length})`)
}

// The clone endpoint keys off the prefixed selection ID (official-* / user-*);
// a bare number is rejected as TEMPLATE_NOT_FOUND, which resolveRef spares us.
const payload = { sourceId: source.selectionId }
if (flags.name) payload.name = flags.name
if (content != null) payload.content = content

const { status, body } = await api('/api/templates/clone', json(payload))
if (status !== 201) failResponse(status, body, `Template '${source.selectionId}'`)

const created = body?.template
console.log(`✓ Cloned ${source.selectionId} → user template #${created.id} "${created.name}"`)
console.log(`  ${created.content.length} chars, style ${created.aiStyle}, selection ID user-${created.id}`)
// Worth stating: the endpoint copies name/content/aiStyle only, so anything the
// caller expected to carry over has to be set with update.mjs.
if (source.description || source.tags) {
  console.log(`  Note: description and tags are not copied — set them with update.mjs if needed.`)
}
