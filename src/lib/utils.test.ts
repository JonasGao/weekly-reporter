import { describe, it, expect } from 'vitest'
import { normalizeRepoName } from './utils'

describe('normalizeRepoName', () => {
  it('should normalize HTTPS URLs', () => {
    expect(normalizeRepoName('https://github.com/owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepoName('https://github.com/owner/repo')).toBe('owner/repo')
    expect(normalizeRepoName('https://gitlab.com/team/project')).toBe('team/project')
  })

  it('should normalize SSH URLs (git@host:owner/repo)', () => {
    expect(normalizeRepoName('git@github.com:owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepoName('git@gitlab.com:team/project')).toBe('team/project')
  })

  it('should normalize ssh:// URLs', () => {
    expect(normalizeRepoName('ssh://git@github.com/owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepoName('ssh://git@gitlab.com/team/project')).toBe('team/project')
  })

  it('should handle self-hosted services', () => {
    expect(normalizeRepoName('https://git.company.com/devteam/myproject')).toBe('devteam/myproject')
    expect(normalizeRepoName('git@git.company.com:devteam/myproject.git')).toBe('devteam/myproject')
  })

  it('should return plain directory names as-is', () => {
    expect(normalizeRepoName('weekly-reporter')).toBe('weekly-reporter')
    expect(normalizeRepoName('my-project')).toBe('my-project')
  })

  it('should handle empty and invalid inputs', () => {
    expect(normalizeRepoName('')).toBe('')
    expect(normalizeRepoName('  ')).toBe('')
  })

  it('should handle URLs with trailing slashes', () => {
    expect(normalizeRepoName('https://github.com/owner/repo/')).toBe('owner/repo')
  })
})
