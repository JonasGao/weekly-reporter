import { describe, it, expect } from 'vitest'
import { parseTags, highlightTags } from './parser'

describe('parseTags', () => {
  it('should parse single tag', () => {
    const result = parseTags('完成评审 #成果')
    expect(result.content).toBe('完成评审')
    expect(result.tags).toEqual(['成果'])
  })

  it('should parse multiple tags', () => {
    const result = parseTags('修复 bug #工作 #风险')
    expect(result.content).toBe('修复 bug')
    expect(result.tags).toEqual(['工作', '风险'])
  })

  it('should handle no tags', () => {
    const result = parseTags('纯文本记录')
    expect(result.content).toBe('纯文本记录')
    expect(result.tags).toEqual([])
  })

  it('should handle tags with Chinese characters', () => {
    const result = parseTags('完成了功能 #重要 #会议纪要')
    expect(result.content).toBe('完成了功能')
    expect(result.tags).toEqual(['重要', '会议纪要'])
  })

  it('should handle tags with English characters', () => {
    const result = parseTags('Fixed bug #bug #urgent')
    expect(result.content).toBe('Fixed bug')
    expect(result.tags).toEqual(['bug', 'urgent'])
  })

  it('should handle tags with mixed characters', () => {
    const result = parseTags('Meeting #会议 #projectX')
    expect(result.content).toBe('Meeting')
    expect(result.tags).toEqual(['会议', 'projectX'])
  })

  it('should handle tags at the beginning', () => {
    const result = parseTags('#成果 完成了任务')
    expect(result.content).toBe('完成了任务')
    expect(result.tags).toEqual(['成果'])
  })

  it('should handle multiple consecutive tags', () => {
    const result = parseTags('#成果#工作#风险')
    expect(result.content).toBe('')
    expect(result.tags).toEqual(['成果', '工作', '风险'])
  })

  it('should handle extra spaces around tags', () => {
    const result = parseTags('完成评审  #成果  #工作 ')
    expect(result.content).toBe('完成评审')
    expect(result.tags).toEqual(['成果', '工作'])
  })
})

describe('highlightTags', () => {
  it('should wrap tags in highlight span', () => {
    const result = highlightTags('完成评审 #成果')
    expect(result).toBe('完成评审 <span class="bg-blue-100 px-1 rounded">#成果</span>')
  })

  it('should handle multiple tags', () => {
    const result = highlightTags('修复 bug #工作 #风险')
    expect(result).toBe('修复 bug <span class="bg-blue-100 px-1 rounded">#工作</span> <span class="bg-blue-100 px-1 rounded">#风险</span>')
  })

  it('should handle no tags', () => {
    const result = highlightTags('纯文本记录')
    expect(result).toBe('纯文本记录')
  })
})