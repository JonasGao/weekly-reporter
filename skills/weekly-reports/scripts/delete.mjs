#!/usr/bin/env node

// Delete a weekly report along with its variants, snapshots and sessions.
// Usage: delete.mjs <id> --confirm

import { api, fail, failResponse, parseArgs, requireId } from './lib/client.mjs'

const USAGE = 'Usage: delete.mjs <id> --confirm'

const { flags, positional } = parseArgs(process.argv.slice(2), { '--confirm': 'boolean' }, USAGE)
const reportId = requireId(positional[0], USAGE)

// Deleting a report also removes its event snapshots and generation history, and
// nothing restores it. Requiring --confirm makes that a deliberate second step.
if (!flags.confirm) {
  const { status, body } = await api(`/api/reports/${reportId}`)
  if (status !== 200) failResponse(status, body, `Report #${reportId}`)
  console.error(`Refusing to delete without --confirm.`)
  console.error(`  #${body.id} ${body.title} (${body.weekStart} ~ ${body.weekEnd})`)
  console.error(`  ${(body.variants ?? []).length} variant(s), ${(body.snapshots ?? []).length} snapshot event(s) would be removed permanently.`)
  fail(`Rerun: delete.mjs ${reportId} --confirm`)
}

const { status, body } = await api(`/api/reports/${reportId}`, { method: 'DELETE' })
if (status !== 200) failResponse(status, body, `Report #${reportId}`)

console.log(`✓ Report #${reportId} deleted`)
