import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'
import type { RawEvent, ProjectScope, SectionType } from '@/lib/db/schema'

describe('renderTemplate - 来源分组排序', () => {
  const createEvent = (
    content: string,
    source: string,
    sectionType: string,
    hoursAgo: number,
    metadata?: RawEvent['metadata']
  ): RawEvent => ({
    id: Math.random(),
    eventTime: new Date(Date.now() - hoursAgo * 3600000),
    source,
    content,
    metadata: metadata ?? { repo: 'owner/repo', sha: 'abc123', sourceId: 1 },
    category: '核心开发',
    sectionType: sectionType as SectionType,
    isImportant: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const renderAchievements = (events: RawEvent[], sourceScopes?: Map<number, ProjectScope>) =>
    renderTemplate(`## 核心成果\n{{核心成果}}`, {
      events,
      sectionTypeMap: { 核心成果: 'achievement' },
      sourceScopes,
    })

  it('手动组事件排在采集事件之前，即使时间更旧', () => {
    const events: RawEvent[] = [
      createEvent('最新的 commit', 'git-local', 'achievement', 1),
      createEvent('十天前手动补录的评审', 'manual', 'achievement', 240, {}),
    ]
    const scopes = new Map<number, ProjectScope>([[1, 'work']])

    const result = renderAchievements(events, scopes)
    const lines = result.split('\n').filter((l) => l.trim())

    expect(lines[1]).toContain('十天前手动补录的评审')
    expect(lines[2]).toContain('**owner/repo**')
  })

  it('采集-工作组排在采集-个人组之前，无论时间新旧', () => {
    const events: RawEvent[] = [
      createEvent('个人项目的 commit', 'git-local', 'achievement', 1, {
        repo: 'me/side-project',
        sourceId: 2,
      }),
      createEvent('工作项目的 commit', 'git-local', 'achievement', 100, {
        repo: 'corp/platform',
        sourceId: 1,
      }),
    ]
    const scopes = new Map<number, ProjectScope>([
      [1, 'work'],
      [2, 'personal'],
    ])

    const result = renderAchievements(events, scopes)
    const lines = result.split('\n').filter((l) => l.trim())

    expect(lines[1]).toContain('**corp/platform**')
    expect(lines[3]).toContain('**me/side-project**')
  })

  it('采集源已删除的事件进入其他组，排在最后', () => {
    const events: RawEvent[] = [
      createEvent('来源已删除的 commit', 'git-local', 'achievement', 1, {
        repo: 'ghost/repo',
        sourceId: 999,
      }),
      createEvent('个人项目的 commit', 'git-local', 'achievement', 50, {
        repo: 'me/side-project',
        sourceId: 2,
      }),
    ]
    const scopes = new Map<number, ProjectScope>([[2, 'personal']])

    const result = renderAchievements(events, scopes)
    const lines = result.split('\n').filter((l) => l.trim())

    expect(lines[1]).toContain('**me/side-project**')
    expect(lines[3]).toContain('**ghost/repo**')
  })

  it('组内仍保持仓库分组和时间倒序', () => {
    const events: RawEvent[] = [
      createEvent('repo-a 的旧 commit', 'git-local', 'achievement', 10, {
        repo: 'corp/repo-a',
        sourceId: 1,
      }),
      createEvent('repo-a 的新 commit', 'git-local', 'achievement', 2, {
        repo: 'corp/repo-a',
        sourceId: 1,
      }),
      createEvent('repo-b 的 commit', 'git-local', 'achievement', 5, {
        repo: 'corp/repo-b',
        sourceId: 1,
      }),
    ]
    const scopes = new Map<number, ProjectScope>([[1, 'work']])

    const result = renderAchievements(events, scopes)
    const lines = result.split('\n').filter((l) => l.trim())

    // 同一来源分组内，仓库组仍按最新 commit 时间倒序
    expect(lines[1]).toContain('**corp/repo-a**')
    expect(lines[2]).toContain('repo-a 的新 commit')
    expect(lines[3]).toContain('repo-a 的旧 commit')
    expect(lines[4]).toContain('**corp/repo-b**')
  })

  it('不传 sourceScopes 时，所有采集事件按其他组处理且组内时间倒序', () => {
    const events: RawEvent[] = [
      createEvent('手动笔记', 'manual', 'achievement', 100, {}),
      createEvent('旧 commit', 'git-local', 'achievement', 10, {
        repo: 'owner/old',
        sourceId: 1,
      }),
      createEvent('新 commit', 'git-local', 'achievement', 1, {
        repo: 'owner/new',
        sourceId: 2,
      }),
    ]

    const result = renderAchievements(events)
    const lines = result.split('\n').filter((l) => l.trim())

    expect(lines[1]).toContain('手动笔记')
    expect(lines[2]).toContain('**owner/new**')
    expect(lines[4]).toContain('**owner/old**')
  })
})
