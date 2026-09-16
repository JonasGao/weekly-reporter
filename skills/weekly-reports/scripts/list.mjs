#!/usr/bin/env node

// List or search weekly reports.
// Usage: list.mjs [--page <n>] [--page-size <n>] [--query <text>] [--start <YYYY-MM-DD>] [--end <YYYY-MM-DD>]

import { api, failResponse, parseArgs, requireDate } from './lib/client.mjs'

const USAGE = 'Usage: list.mjs [--page <n>] [--page-size <n>] [--query <text>] [--start <YYYY-MM-DD>] [--end <YYYY-MM-DD>]'

const { flags } = parseArgs(process.argv.slice(2), {
  '--page': 'value',
  '--page-size': 'value',
  '--query': 'value',
  '--start': 'value',
  '--end': 'value',
}, USAGE)

const isSearch = flags.query != null || flags.start != null || flags.end != null

let path
if (isSearch) {
  const params = new URLSearchParams()
  if (flags.query) params.set('q', flags.query)
  if (flags.start) params.set('startDate', requireDate(flags.start, '--start'))
  if (flags.end) params.set('endDate', requireDate(flags.end, '--end'))
  path = `/api/reports/search?${params}`
} else {
  const params = new URLSearchParams()
  params.set('page', flags.page ?? '1')
  params.set('pageSize', flags['page-size'] ?? '10')
  path = `/api/reports?${params}`
}

const { status, body } = await api(path)
if (status !== 200) failResponse(status, body, 'Reports')

const reports = body?.reports ?? []
if (reports.length === 0) {
  console.log('No reports found.')
  process.exit(0)
}

// One line per report. Variant state is the thing a caller usually needs next
// (which audience already has an adopted final), so it goes on the same line.
for (const report of reports) {
  const id = `#${report.id}`.padEnd(5)
  const week = `${report.weekStart}~${report.weekEnd}`
  const variants = (report.variants ?? [])
    .map((variant) => `${variant.variant}:${variant.finalStatus ?? 'none'}`)
    .join(' ')
  console.log(`${id} ${week}  ${report.title}${variants ? `  [${variants}]` : ''}`)
}

if (isSearch) {
  console.log(`\n${reports.length} report${reports.length === 1 ? '' : 's'} matched (newest first)`)
} else {
  const { total, page, pageSize } = body
  const pages = Math.max(1, Math.ceil((total ?? 0) / (pageSize || 1)))
  console.log(`\n${reports.length} of ${total ?? reports.length} report(s) — page ${page}/${pages}, newest first`)
}
