#!/usr/bin/env node

// Create a new user template from scratch.
// Usage: create.mjs --name <text> (--content <text> | --file <path>)
//                   [--description <text>] [--tags <a,b>] [--style <key>]

import { readFile } from 'node:fs/promises'
import { api, fail, failResponse, json, parseArgs, requireStyle } from './lib/client.mjs'

const USAGE = 'Usage: create.mjs --name <text> (--content <text> | --file <path>) [--description <text>] [--tags <a,b>] [--style <key>]'

const { flags } = parseArgs(process.argv.slice(2), {
  '--name': 'value',
  '--content': 'value',
  '--file': 'value',
  '--description': 'value',
  '--tags': 'value',
  '--style': 'value',
}, USAGE)

if (!flags.name || !flags.name.trim()) fail('Error: --name is required', USAGE)
if (flags.name.length > 100) fail(`Error: --name must be at most 100 characters (got ${flags.name.length})`)
if ((flags.content == null) === (flags.file == null)) {
  fail('Error: provide exactly one of --content or --file', USAGE)
}

// Template bodies are multi-line markdown instructions. --file is the reliable
// path; shell quoting mangles anything longer than a sentence.
let content = flags.content
if (flags.file != null) {
  try {
    content = await readFile(flags.file, 'utf8')
  } catch (error) {
    fail(`Error: cannot read --file '${flags.file}': ${error.message}`)
  }
}
if (!content || !content.trim()) fail('Error: template content cannot be empty')

if (flags.description != null && flags.description.length > 200) {
  fail(`Error: --description must be at most 200 characters (got ${flags.description.length})`)
}

const payload = { name: flags.name.trim(), content }
if (flags.description) payload.description = flags.description
if (flags.tags) payload.tags = flags.tags
// Validated against the styles that exist, because the API stores any
// well-shaped key and the mismatch would only surface at generation time.
if (flags.style) payload.aiStyle = await requireStyle(flags.style)

const { status, body } = await api('/api/templates', json(payload))
if (status !== 201) failResponse(status, body, 'Template')

const created = body?.template
console.log(`✓ Created user template #${created.id} "${created.name}" — ${content.length} chars, style ${created.aiStyle}`)
console.log(`  Selection ID for generation: user-${created.id}`)
