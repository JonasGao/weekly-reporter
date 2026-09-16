#!/usr/bin/env node

// Update a user template in place. Only the fields you pass change.
// Usage: update.mjs <ref> [--name <text>] [--content <text> | --file <path>]
//                   [--description <text>] [--tags <a,b>] [--style <key>]

import { readFile } from 'node:fs/promises'
import { api, fail, failResponse, jsonPut, parseArgs, requireStyle, requireUserTemplate, resolveRef } from './lib/client.mjs'

const USAGE = 'Usage: update.mjs <ref> [--name <text>] [--content <text> | --file <path>] [--description <text>] [--tags <a,b>] [--style <key>]'

const { flags, positional } = parseArgs(process.argv.slice(2), {
  '--name': 'value',
  '--content': 'value',
  '--file': 'value',
  '--description': 'value',
  '--tags': 'value',
  '--style': 'value',
}, USAGE)

const template = requireUserTemplate(await resolveRef(positional[0], USAGE), 'edited')

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

const changed = ['name', 'content', 'file', 'description', 'tags', 'style'].filter((key) => flags[key] != null)
if (changed.length === 0) fail('Error: nothing to update — pass at least one field', USAGE)

if (flags.name != null && !flags.name.trim()) fail('Error: --name cannot be empty')
if (flags.name != null && flags.name.length > 100) fail(`Error: --name must be at most 100 characters (got ${flags.name.length})`)
if (content != null && !content.trim()) fail('Error: --content cannot be empty')
if (flags.description != null && flags.description.length > 200) {
  fail(`Error: --description must be at most 200 characters (got ${flags.description.length})`)
}

// PUT validates the whole object, so name and content must always be present.
// Sending the stored values for anything the caller didn't pass is what turns
// this into the partial edit they actually asked for.
const payload = {
  name: flags.name != null ? flags.name.trim() : template.name,
  content: content != null ? content : template.content,
}
const description = flags.description != null ? flags.description : template.description
const tags = flags.tags != null ? flags.tags : template.tags
if (description) payload.description = description
if (tags) payload.tags = tags
payload.aiStyle = flags.style != null ? await requireStyle(flags.style) : template.aiStyle

const { status, body } = await api(template.apiPath, jsonPut(payload))
if (status !== 200) failResponse(status, body, template.selectionId)

const updated = body?.template
console.log(`✓ Updated ${template.selectionId} "${updated.name}" — changed: ${changed.join(', ')}`)
console.log(`  ${updated.content.length} chars, style ${updated.aiStyle}`)
// Finals already generated from this template kept a content snapshot, so this
// edit only affects generation sessions started from now on.
console.log('  Existing finals keep their template snapshot; this affects new generation sessions only.')
