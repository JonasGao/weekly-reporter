import { describe, expect, it } from 'vitest'
import { parseTags, removeTagFromContent, renameTagInContent, TAG_CHARSET_REGEX } from './parse'

describe('TAG_CHARSET_REGEX', () => {
  it('accepts Chinese, letters, digits', () => {
    expect(TAG_CHARSET_REGEX.test('工作')).toBe(true)
    expect(TAG_CHARSET_REGEX.test('tag123')).toBe(true)
    expect(TAG_CHARSET_REGEX.test('工作tag1')).toBe(true)
  })
  it('rejects hyphen, underscore, space, punctuation', () => {
    expect(TAG_CHARSET_REGEX.test('tag-name')).toBe(false)
    expect(TAG_CHARSET_REGEX.test('tag_name')).toBe(false)
    expect(TAG_CHARSET_REGEX.test('tag name')).toBe(false)
    expect(TAG_CHARSET_REGEX.test('')).toBe(false)
  })
})

describe('parseTags', () => {
  it('extracts a tag surrounded by spaces', () => {
    expect(parseTags('今天 #工作 完成了')).toEqual(['工作'])
  })
  it('extracts two adjacent tags with single space', () => {
    expect(parseTags('#a #b')).toEqual(['a', 'b'])
  })
  it('returns empty for #a#b (no gap between)', () => {
    expect(parseTags('#a#b')).toEqual([])
  })
  it('handles tags on separate lines', () => {
    expect(parseTags('#a\n#b')).toEqual(['a', 'b'])
  })
  it('rejects a tag preceded by non-whitespace (中的#b)', () => {
    expect(parseTags('#a 中的#b')).toEqual(['a'])
  })
  it('accepts Chinese-only and mixed tags', () => {
    expect(parseTags('#工作')).toEqual(['工作'])
    expect(parseTags('#工作1')).toEqual(['工作1'])
  })
  it('matches a tag at end of content (no trailing space)', () => {
    expect(parseTags('内容 #tag')).toEqual(['tag'])
  })
  it('deduplicates repeated tags', () => {
    expect(parseTags('#工作 #工作')).toEqual(['工作'])
  })
  it('rejects #tag-name (hyphen not in charset, tag not boundary-terminated)', () => {
    expect(parseTags('#tag-name')).toEqual([])
  })
  it('is case-sensitive and preserves case', () => {
    expect(parseTags('#Foo #foo')).toEqual(['Foo', 'foo'])
  })
  it('returns empty for content without tags', () => {
    expect(parseTags('just plain text')).toEqual([])
  })
  it('handles leading/trailing newlines', () => {
    expect(parseTags('\n#tag\n')).toEqual(['tag'])
  })
})

describe('removeTagFromContent', () => {
  it('removes a middle tag collapsing multiple spaces to one', () => {
    expect(removeTagFromContent('这是内容 #tag1 #tag2', 'tag1')).toBe('这是内容 #tag2')
  })
  it('collapses multi-space boundary to single space', () => {
    expect(removeTagFromContent('内容  #tag1  #tag2', 'tag1')).toBe('内容 #tag2')
  })
  it('removes a tag at start', () => {
    expect(removeTagFromContent('#tag1 内容', 'tag1')).toBe('内容')
  })
  it('removes a tag at end', () => {
    expect(removeTagFromContent('内容 #tag1', 'tag1')).toBe('内容')
  })
  it('does not touch a prefix-sharing tag (#工作日志 vs #工作)', () => {
    expect(removeTagFromContent('#工作日志 #工作', '工作')).toBe('#工作日志')
  })
  it('removes across lines and normalizes removal site to single space', () => {
    expect(removeTagFromContent('line1 #tag\nline2 #tag', 'tag')).toBe('line1 line2')
  })
  it('returns empty string when tag is the entire content', () => {
    expect(removeTagFromContent('#tag', 'tag')).toBe('')
  })
  it('returns content unchanged when tag is not present', () => {
    expect(removeTagFromContent('no tags here', 'tag')).toBe('no tags here')
  })
  it('removes all occurrences of the tag', () => {
    expect(removeTagFromContent('#tag middle #tag end', 'tag')).toBe('middle end')
  })
  it('handles tag with leading space only', () => {
    expect(removeTagFromContent('  #tag  content', 'tag')).toBe('content')
  })
})

describe('renameTagInContent', () => {
  it('renames a tag at start', () => {
    expect(renameTagInContent('#old content', 'old', 'new')).toBe('#new content')
  })
  it('does not rename a prefix-sharing tag (#oldx unchanged)', () => {
    expect(renameTagInContent('#oldx content', 'old', 'new')).toBe('#oldx content')
  })
  it('renames only the exact-boundary tag', () => {
    expect(renameTagInContent('#工作日志 #工作', '工作', '任务')).toBe('#工作日志 #任务')
  })
  it('renames multiple occurrences', () => {
    expect(renameTagInContent('#old middle #old end', 'old', 'new')).toBe('#new middle #new end')
  })
  it('preserves surrounding whitespace', () => {
    expect(renameTagInContent('a  #old  b', 'old', 'new')).toBe('a  #new  b')
  })
})
