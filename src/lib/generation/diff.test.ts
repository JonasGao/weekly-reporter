import { describe, expect, it } from 'vitest'
import { lineDiff } from './diff'

describe('lineDiff', () => {
  it('returns all same for identical input', () => {
    const result = lineDiff('a\nb\nc', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'same', value: 'a' },
      { type: 'same', value: 'b' },
      { type: 'same', value: 'c' },
    ])
  })

  it('marks added lines', () => {
    const result = lineDiff('a\nc', 'a\nb\nc')
    expect(result).toEqual([
      { type: 'same', value: 'a' },
      { type: 'add', value: 'b' },
      { type: 'same', value: 'c' },
    ])
  })

  it('marks removed lines', () => {
    const result = lineDiff('a\nb\nc', 'a\nc')
    expect(result).toEqual([
      { type: 'same', value: 'a' },
      { type: 'remove', value: 'b' },
      { type: 'same', value: 'c' },
    ])
  })

  it('handles a mixed change', () => {
    const result = lineDiff('a\nb\nc', 'a\nB\nd')
    expect(result).toEqual([
      { type: 'same', value: 'a' },
      { type: 'remove', value: 'b' },
      { type: 'remove', value: 'c' },
      { type: 'add', value: 'B' },
      { type: 'add', value: 'd' },
    ])
  })

  it('falls back to bulk remove/add for large inputs', () => {
    const big1 = Array.from({ length: 500 }, (_, i) => `line${i}`).join('\n')
    const big2 = Array.from({ length: 500 }, (_, i) => `other${i}`).join('\n')
    const result = lineDiff(big1, big2)
    expect(result.length).toBe(1000)
    expect(result.slice(0, 500).every((line) => line.type === 'remove')).toBe(true)
    expect(result.slice(500).every((line) => line.type === 'add')).toBe(true)
  })
})
