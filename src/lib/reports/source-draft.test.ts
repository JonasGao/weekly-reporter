import { describe, expect, it } from 'vitest'
import type { RawEvent } from '@/lib/db/schema'
import { buildSourceDraft } from './source-draft'

function event(partial: Partial<RawEvent>): RawEvent {
  return {
    id: partial.id ?? 1,
    eventTime: partial.eventTime ?? new Date('2026-08-17T12:00:00Z'),
    source: partial.source ?? 'manual',
    content: partial.content ?? '完成一项工作',
    metadata: partial.metadata ?? null,
    category: null,
    isImportant: false,
    createdAt: new Date('2026-08-17T12:00:00Z'),
    updatedAt: new Date('2026-08-17T12:00:00Z'),
  }
}

describe('buildSourceDraft', () => {
  it('keeps the origin priority and repository nesting for both audience variants', () => {
    const events = [
      event({ id: 1, content: '个人项目', source: 'git-remote-github', metadata: { sourceId: 2, repo: 'personal-repo' }, eventTime: new Date('2026-08-17T09:00:00Z') }),
      event({ id: 2, content: '工作项目', source: 'git-remote-github', metadata: { sourceId: 1, repo: 'work-repo' }, eventTime: new Date('2026-08-17T10:00:00Z') }),
      event({ id: 3, content: '手动重点', source: 'manual', eventTime: new Date('2026-08-17T08:00:00Z') }),
    ]
    const scopes = new Map([[1, 'work' as const], [2, 'personal' as const]])

    const leadership = buildSourceDraft(events, 'leadership', scopes)
    const personal = buildSourceDraft(events, 'personal', scopes)

    expect(leadership).toContain('手动重点')
    expect(leadership).toContain('work-repo')
    expect(leadership).not.toContain('personal-repo')
    expect(personal).toContain('personal-repo')
    expect(personal.indexOf('手动重点')).toBeLessThan(personal.indexOf('work-repo'))
  })

  it('returns an explicit empty draft', () => {
    expect(buildSourceDraft([], 'personal')).toBe('- 本周暂无事件')
  })

})
