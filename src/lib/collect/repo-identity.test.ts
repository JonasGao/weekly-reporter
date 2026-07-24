import { describe, it, expect } from 'vitest'
import { planScanAdditions, sourcePaths } from './repo-identity'

describe('planScanAdditions', () => {
  it('marks paths already in a source as already-added', () => {
    const result = planScanAdditions(
      [{ path: '/repos/a', identity: 'org/a' }],
      [{ id: 1, name: 'A', identity: 'org/a', paths: ['/repos/a'] }],
    )
    expect(result).toEqual([{ kind: 'already-added' }])
  })

  it('merges worktree/clone with same identity into existing source', () => {
    const result = planScanAdditions(
      [{ path: '/repos/a-worktree', identity: 'org/a' }],
      [{ id: 1, name: 'A', identity: 'org/a', paths: ['/repos/a'] }],
    )
    expect(result).toEqual([{ kind: 'merge', targetSourceId: 1, targetSourceName: 'A' }])
  })

  it('does not merge when identity differs', () => {
    const result = planScanAdditions(
      [{ path: '/repos/b', identity: 'org/b' }],
      [{ id: 1, name: 'A', identity: 'org/a', paths: ['/repos/a'] }],
    )
    expect(result).toEqual([{ kind: 'create', groupKey: 'org/b' }])
  })

  it('does not merge repos without origin (identity null)', () => {
    const result = planScanAdditions(
      [{ path: '/repos/local', identity: null }],
      [{ id: 1, name: 'A', identity: null, paths: ['/repos/a'] }],
    )
    expect(result).toEqual([{ kind: 'create', groupKey: null }])
  })

  it('does not match against sources with null identity', () => {
    const result = planScanAdditions(
      [{ path: '/repos/b', identity: 'org/b' }],
      [{ id: 1, name: 'A', identity: null, paths: ['/repos/a'] }],
    )
    expect(result).toEqual([{ kind: 'create', groupKey: 'org/b' }])
  })

  it('groups same-identity new repos with a shared groupKey', () => {
    const result = planScanAdditions(
      [
        { path: '/repos/a', identity: 'org/a' },
        { path: '/repos/a-wt', identity: 'org/a' },
        { path: '/repos/c', identity: null },
      ],
      [],
    )
    expect(result).toEqual([
      { kind: 'create', groupKey: 'org/a' },
      { kind: 'create', groupKey: 'org/a' },
      { kind: 'create', groupKey: null },
    ])
  })

  it('checks already-added against all source paths, not just owner', () => {
    const result = planScanAdditions(
      [{ path: '/repos/a-wt', identity: 'org/a' }],
      [{ id: 1, name: 'A', identity: 'org/a', paths: ['/repos/a', '/repos/a-wt'] }],
    )
    expect(result).toEqual([{ kind: 'already-added' }])
  })
})

describe('sourcePaths', () => {
  it('returns paths when present', () => {
    expect(sourcePaths({ config: { owner: '/a', authorEmails: [], paths: [{ path: '/a' }, { path: '/b' }] } }))
      .toEqual(['/a', '/b'])
  })

  it('falls back to owner for legacy sources', () => {
    expect(sourcePaths({ config: { owner: '/a', authorEmails: [] } })).toEqual(['/a'])
  })
})
