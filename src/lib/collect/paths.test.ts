import { describe, it, expect } from 'vitest'
import { normalizePaths, toPaths, maxBranchCursor, shouldResetCursor } from './paths'

describe('normalizePaths', () => {
  it('returns null when paths is missing or empty (legacy branches model)', () => {
    expect(normalizePaths({ owner: '/a', authorEmails: [] })).toBeNull()
    expect(normalizePaths({ owner: '/a', authorEmails: [], paths: [] })).toBeNull()
  })

  it('normalizes entries with defaults', () => {
    expect(normalizePaths({
      owner: '/a',
      authorEmails: [],
      paths: [{ path: '/a' }, { path: '/b', lastBranch: 'main', lastCommitTime: '2026-01-01T00:00:00Z' }],
    })).toEqual([
      { path: '/a', lastBranch: null, lastCommitTime: null },
      { path: '/b', lastBranch: 'main', lastCommitTime: '2026-01-01T00:00:00Z' },
    ])
  })
})

describe('toPaths', () => {
  it('returns existing paths unchanged', () => {
    const config = {
      owner: '/a',
      authorEmails: [],
      paths: [{ path: '/a' }, { path: '/b', lastBranch: 'dev' }],
    }
    expect(toPaths(config)).toEqual([
      { path: '/a', lastBranch: null, lastCommitTime: null },
      { path: '/b', lastBranch: 'dev', lastCommitTime: null },
    ])
  })

  it('converts legacy branches model to single owner path with max cursor', () => {
    const config = {
      owner: '/a',
      authorEmails: [],
      branches: [
        { name: 'main', lastCommitTime: '2026-01-01T00:00:00Z' },
        { name: 'dev', lastCommitTime: '2026-03-01T00:00:00Z' },
        'legacy-string-branch',
      ],
    }
    expect(toPaths(config)).toEqual([
      { path: '/a', lastBranch: null, lastCommitTime: '2026-03-01T00:00:00Z' },
    ])
  })

  it('converts legacy model without branches to null cursor', () => {
    expect(toPaths({ owner: '/a', authorEmails: [] })).toEqual([
      { path: '/a', lastBranch: null, lastCommitTime: null },
    ])
  })
})

describe('maxBranchCursor', () => {
  it('returns max cursor across branch entries', () => {
    expect(maxBranchCursor([
      { name: 'a', lastCommitTime: '2026-01-01T00:00:00Z' },
      { name: 'b', lastCommitTime: '2026-02-01T00:00:00Z' },
      { name: 'c' },
      'plain',
    ])).toBe('2026-02-01T00:00:00Z')
  })

  it('returns null for missing/empty branches', () => {
    expect(maxBranchCursor(undefined)).toBeNull()
    expect(maxBranchCursor([])).toBeNull()
  })
})

describe('shouldResetCursor', () => {
  it('resets when recorded branch differs from current', () => {
    expect(shouldResetCursor({ path: '/a', lastBranch: 'main', lastCommitTime: null }, 'dev')).toBe(true)
  })

  it('does not reset when branch matches', () => {
    expect(shouldResetCursor({ path: '/a', lastBranch: 'main', lastCommitTime: null }, 'main')).toBe(false)
  })

  it('does not reset when lastBranch is null (new or converted entry)', () => {
    expect(shouldResetCursor({ path: '/a', lastBranch: null, lastCommitTime: '2026-01-01T00:00:00Z' }, 'dev')).toBe(false)
  })
})
