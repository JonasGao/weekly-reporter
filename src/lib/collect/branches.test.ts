import { describe, expect, it } from 'vitest'
import { mergeEditedBranches } from './branches'

describe('mergeEditedBranches', () => {
  it('preserves cursors for exact names and resets renamed branches', () => {
    const result = mergeEditedBranches(
      [{ name: 'main', lastCommitTime: '2026-08-24T10:00:00.000Z' }, 'develop'],
      [{ name: 'main' }, { name: 'release' }],
    )

    expect(result).toEqual([
      { name: 'main', lastCommitTime: '2026-08-24T10:00:00.000Z' },
      { name: 'release', lastCommitTime: null },
    ])
  })

  it('trims names, removes empty entries and deduplicates exact names', () => {
    expect(mergeEditedBranches(undefined, [{ name: ' main ' }, { name: '' }, 'main'])).toEqual([
      { name: 'main', lastCommitTime: null },
    ])
  })

  it('returns undefined for an empty configuration', () => {
    expect(mergeEditedBranches([{ name: 'main', lastCommitTime: '2026-08-24T10:00:00.000Z' }], [])).toBeUndefined()
  })
})
