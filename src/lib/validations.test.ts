import { describe, it, expect } from 'vitest'
import { collectSourceSchema } from './validations'

const HOME = process.env.HOME || '/home'

function localSource(config: Record<string, unknown>) {
  return {
    type: 'git-local' as const,
    name: '本地源',
    projectScope: 'personal' as const,
    config: { authorEmails: ['a@b.c'], ...config },
  }
}

describe('collectSourceSchema git-local 路径展开', () => {
  it('expands ~ in owner to $HOME', () => {
    const result = collectSourceSchema.parse(localSource({ owner: '~/github/repo' }))
    expect(result.config.owner).toBe(`${HOME}/github/repo`)
  })

  it('strips trailing slashes from stored paths', () => {
    const result = collectSourceSchema.parse(localSource({ owner: '~/github/repo/' }))
    expect(result.config.owner).toBe(`${HOME}/github/repo`)
  })

  it('keeps a lone / intact', () => {
    const result = collectSourceSchema.parse(localSource({ owner: '/' }))
    expect(result.config.owner).toBe('/')
  })

  it('leaves remote types untouched', () => {
    const result = collectSourceSchema.parse({
      type: 'git-remote-github',
      name: '远端源',
      projectScope: 'work',
      config: {
        owner: 'my-org',
        repo: 'backend',
        token: 'secret',
        authorEmails: ['a@b.c'],
      },
    })
    expect(result.config.owner).toBe('my-org')
  })
})
