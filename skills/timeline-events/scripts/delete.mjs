#!/usr/bin/env node

// Delete an event from the weekly-reporter timeline API
// Usage: delete.mjs <id>

const WEEKLY_REPORTER_URL = process.env.WEEKLY_REPORTER_URL || 'http://localhost:6868'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Error: event ID is required')
  console.error('Usage: delete.mjs <id>')
  process.exit(1)
}

const eventId = parseInt(args[0])
if (isNaN(eventId)) {
  console.error(`Error: invalid event ID '${args[0]}'`)
  process.exit(1)
}

let response
try {
  response = await fetch(`${WEEKLY_REPORTER_URL}/api/events/${eventId}`, {
    method: 'DELETE',
  })
} catch {
  console.error(`Error: Cannot reach weekly-reporter at ${WEEKLY_REPORTER_URL}`)
  console.error('Is the server running? Try: npm run dev')
  process.exit(1)
}

const status = response.status

if (status === 204) {
  console.log(`✓ Event #${eventId} deleted`)
  process.exit(0)
}

let body = null
try {
  body = await response.json()
} catch {
  // Non-JSON response
}

if (status === 404) {
  console.error(`Error: Event #${eventId} not found`)
  process.exit(1)
}

if (status === 403) {
  const errorMsg = body?.error || 'Cannot delete non-manual event'
  console.error(`Error: ${errorMsg}`)
  process.exit(1)
}

if (status >= 400 && status < 500) {
  const errorMsg = body?.error || body?.message || `HTTP ${status}`
  console.error(`Error: ${errorMsg}`)
  process.exit(1)
}

if (status >= 500) {
  console.error(`Error: Server error (HTTP ${status})`)
  process.exit(1)
}

console.error(`Error: Unexpected response (HTTP ${status})`)
process.exit(1)
