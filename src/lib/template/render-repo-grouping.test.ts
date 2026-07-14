import { describe, it, expect } from 'vitest'
import { renderTemplate } from './render'
import type { RawEvent } from '@/lib/db/schema'

describe('renderTemplate - repo grouping', () => {
  const createEvent = (
    content: string,
    source: string,
    repo: string,
    sectionType: string,
    hoursAgo: number
  ): RawEvent => ({
    id: Math.random(),
    eventTime: new Date(Date.now() - hoursAgo * 3600000),
    source,
    content,
    metadata: { repo, sha: 'abc123', url: '', branch: 'main', sourceId: 1, sourceName: 'test' },
    category: '核心开发',
    sectionType: sectionType as any,
    status: 'pending',
    tags: [],
    isImportant: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  it('should group git events by repo and render as nested list', () => {
    const events: RawEvent[] = [
      createEvent('修复了登录bug', 'git-local', 'JonasGao/weekly-reporter', 'achievement', 2),
      createEvent('添加了新功能', 'git-local', 'JonasGao/weekly-reporter', 'achievement', 5),
      createEvent('更新了文档', 'github', 'retail-cloud/retail-platform', 'achievement', 3),
    ]

    const template = `## 核心成果\n{{核心成果}}`
    const result = renderTemplate(template, {
      events,
      sectionTypeMap: { '核心成果': 'achievement' },
    })

    expect(result).toContain('**JonasGao/weekly-reporter**')
    expect(result).toContain('  - 修复了登录bug')
    expect(result).toContain('  - 添加了新功能')
    expect(result).toContain('**retail-cloud/retail-platform**')
    expect(result).toContain('  - 更新了文档')
  })

  it('should render non-git events as flat list items at same level', () => {
    const events: RawEvent[] = [
      createEvent('git commit 1', 'git-local', 'owner/repo', 'achievement', 2),
      { ...createEvent('手动笔记', 'manual', '', 'achievement', 1), metadata: {} },
      { ...createEvent('回复邮件', 'email', '', 'achievement', 3), metadata: {} },
    ]

    const template = `## 核心成果\n{{核心成果}}`
    const result = renderTemplate(template, {
      events,
      sectionTypeMap: { '核心成果': 'achievement' },
    })

    expect(result).toContain('**owner/repo**')
    expect(result).toContain('  - git commit 1')
    expect(result).toContain('- 手动笔记')
    expect(result).toContain('- 回复邮件')
  })

  it('should sort all top-level items by time (most recent first)', () => {
    const events: RawEvent[] = [
      createEvent('旧 commit', 'git-local', 'old-repo', 'achievement', 10),
      { ...createEvent('最新笔记', 'manual', '', 'achievement', 1), metadata: {} },
      createEvent('中等 commit', 'git-local', 'mid-repo', 'achievement', 5),
    ]

    const template = `## 核心成果\n{{核心成果}}`
    const result = renderTemplate(template, {
      events,
      sectionTypeMap: { '核心成果': 'achievement' },
    })

    const lines = result.split('\n')
    const nonEmptyLines = lines.filter(l => l.trim())

    // 第一个应该是最新笔记（1小时前）
    expect(nonEmptyLines[1]).toContain('最新笔记')
    // 第二个应该是 mid-repo（5小时前）
    expect(nonEmptyLines[2]).toContain('**mid-repo**')
    // 第三个应该是 old-repo（10小时前）
    expect(nonEmptyLines[4]).toContain('**old-repo**')
  })

  it('should return empty list placeholder when no events', () => {
    const template = `## 核心成果\n{{核心成果}}`
    const result = renderTemplate(template, {
      events: [],
      sectionTypeMap: { '核心成果': 'achievement' },
    })

    expect(result).toContain('- \n- \n- ')
  })
})
