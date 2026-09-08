import type { AudienceVariant } from '@/lib/db/schema'
import type { NextWeekPlanParseResult } from '@/lib/reports/next-week-plan'

export type CarryForwardJudgment = 'carry' | 'drop' | 'uncertain'

export interface CarryForwardCandidate {
  candidateId: string
  text: string
  normalizedText: string
  source: 'carry-forward'
  judgment: CarryForwardJudgment | null
  reason: string | null
}

export interface CarryForwardSnapshot {
  version: 1
  status: 'found' | 'no-source' | 'no-plan' | 'parse-failed' | 'no-snapshot'
  reason: string | null
  capturedAt: string | null
  source: {
    reportId: number
    title: string
    audience: AudienceVariant
    weekStart: string
    weekEnd: string
    finalStatus: 'current'
    acceptedProposalId: number | null
    updatedAt: string
  } | null
  planText: string | null
  parseStatus: NextWeekPlanParseResult['status'] | 'unavailable'
  parseReason: string | null
  parseWarning: string | null
  candidates: CarryForwardCandidate[]
}

export const LEGACY_NO_SNAPSHOT_REASON = 'This session predates carry-forward snapshots; no history was backfilled.'

export const LEGACY_NO_SNAPSHOT: CarryForwardSnapshot = {
  version: 1,
  status: 'no-snapshot',
  reason: LEGACY_NO_SNAPSHOT_REASON,
  capturedAt: null,
  source: null,
  planText: null,
  parseStatus: 'unavailable',
  parseReason: LEGACY_NO_SNAPSHOT_REASON,
  parseWarning: null,
  candidates: [],
}

function unavailableSnapshot(reason: string): CarryForwardSnapshot {
  return {
    version: 1,
    status: 'no-snapshot',
    reason,
    capturedAt: null,
    source: null,
    planText: null,
    parseStatus: 'unavailable',
    parseReason: reason,
    parseWarning: null,
    candidates: [],
  }
}

export function normalizeCarryForwardSnapshot(value: string | CarryForwardSnapshot | null | undefined): CarryForwardSnapshot {
  if (!value) return LEGACY_NO_SNAPSHOT

  if (typeof value !== 'string') return value
  try {
    const parsed = JSON.parse(value) as Partial<CarryForwardSnapshot>
    if (parsed.version === 1 && Array.isArray(parsed.candidates)) {
      return parsed as CarryForwardSnapshot
    }
  } catch {
    // A malformed value is treated as unavailable rather than interpreted as history.
  }
  return unavailableSnapshot('The stored carry-forward snapshot is unavailable and was not reconstructed.')
}

export function serializeCarryForwardSnapshot(snapshot: CarryForwardSnapshot): string {
  return JSON.stringify(snapshot)
}
