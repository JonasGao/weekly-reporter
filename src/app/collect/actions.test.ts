import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { scanRepos } from './actions'

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    query: {
      collectSources: {
        findMany: mockFindMany,
      },
    },
  })),
}))

describe('scanRepos', () => {
  const tempDirectories: string[] = []

  afterEach(() => {
    mockFindMany.mockReset()
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('scans child directories when the requested directory is itself a git repository', async () => {
    mockFindMany.mockResolvedValue([])

    const root = mkdtempSync(path.join(os.tmpdir(), 'weekly-reporter-scan-'))
    tempDirectories.push(root)
    mkdirSync(path.join(root, '.git'))
    mkdirSync(path.join(root, 'first-repo', '.git'), { recursive: true })
    mkdirSync(path.join(root, 'first-repo', 'nested-repo', '.git'), { recursive: true })
    mkdirSync(path.join(root, 'group', 'second-repo', '.git'), { recursive: true })

    const result = await scanRepos(root, 2)

    expect(result.error).toBeUndefined()
    expect(result.repos.map(repo => repo.path).sort()).toEqual([
      path.join(root, 'first-repo'),
      path.join(root, 'group', 'second-repo'),
    ])
    expect(result.repos.map(repo => repo.path)).not.toContain(root)
  })
})
