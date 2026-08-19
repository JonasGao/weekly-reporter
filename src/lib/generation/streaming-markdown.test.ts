import { describe, expect, it } from 'vitest'
import {
  appendRevealedMarkdown,
  finalizeStreamingMarkdown,
  type StreamingMarkdown,
} from './streaming-markdown'

function emptyStream(): StreamingMarkdown {
  return { markdownBlocks: [], pendingChunks: [] }
}

describe('streaming markdown', () => {
  it('keeps an unfinished paragraph out of Markdown rendering', () => {
    const state = appendRevealedMarkdown(emptyStream(), { id: 1, text: '正在生成 **未完成' })

    expect(state.markdownBlocks).toEqual([])
    expect(state.pendingChunks).toEqual([{ id: 1, text: '正在生成 **未完成' }])
  })

  it('commits completed paragraphs without rebuilding earlier blocks', () => {
    const first = appendRevealedMarkdown(emptyStream(), { id: 1, text: '第一段。\n\n第二' })
    const second = appendRevealedMarkdown(first, { id: 2, text: '段。\n\n第三段' })

    expect(first.markdownBlocks).toEqual(['第一段。\n\n'])
    expect(second.markdownBlocks).toEqual(['第一段。\n\n', '第二段。\n\n'])
    expect(second.pendingChunks).toEqual([{ id: 2, text: '第三段' }])
  })

  it('does not commit a blank line inside a fenced code block', () => {
    const state = appendRevealedMarkdown(emptyStream(), {
      id: 1,
      text: '```ts\nconst answer = 42\n\nconsole.log(answer)\n```\n\n下一段',
    })

    expect(state.markdownBlocks).toEqual(['```ts\nconst answer = 42\n\nconsole.log(answer)\n```\n'])
    expect(state.pendingChunks).toEqual([{ id: 1, text: '下一段' }])
  })

  it('commits complete headings and closed code blocks without waiting for a blank line', () => {
    const heading = appendRevealedMarkdown(emptyStream(), { id: 1, text: '## 本周进展\n正文' })
    const code = appendRevealedMarkdown(emptyStream(), { id: 2, text: '```ts\nconst answer = 42\n```\n下一段' })

    expect(heading.markdownBlocks).toEqual(['## 本周进展\n'])
    expect(heading.pendingChunks).toEqual([{ id: 1, text: '正文' }])
    expect(code.markdownBlocks).toEqual(['```ts\nconst answer = 42\n```\n'])
    expect(code.pendingChunks).toEqual([{ id: 2, text: '下一段' }])
  })

  it('renders the final unfinished block as Markdown only after streaming completes', () => {
    const streamed = appendRevealedMarkdown(emptyStream(), { id: 1, text: '## 结论\n内容' })

    expect(finalizeStreamingMarkdown(streamed)).toEqual({
      markdownBlocks: ['## 结论\n', '内容'],
      pendingChunks: [],
    })
  })
})
