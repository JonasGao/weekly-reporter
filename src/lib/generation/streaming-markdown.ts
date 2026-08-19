export interface RevealedTextChunk {
  id: number
  text: string
}

export interface StreamingMarkdown {
  markdownBlocks: string[]
  pendingChunks: RevealedTextChunk[]
}

interface MarkdownPartition {
  blocks: string[]
  remainder: string
}

/**
 * Commits only safe block boundaries. The unfinished tail stays as plain text
 * so incomplete Markdown cannot reflow prior output.
 */
function partitionStableMarkdown(source: string): MarkdownPartition {
  const blocks: string[] = []
  const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? []
  let blockStart = 0
  let offset = 0
  let fence: { character: string; length: number } | null = null

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    let closedFence = false
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) {
        fence = { character: marker[0], length: marker.length }
      } else if (fence.character === marker[0] && marker.length >= fence.length) {
        fence = null
        closedFence = true
      }
    }

    offset += line.length
    const isCompleteLine = line.endsWith('\n')
    const isHeading = /^\s{0,3}#{1,6}(?:\s|$)/.test(line)
    if (!fence && (closedFence || /^\s*\r?\n$/.test(line) || (isCompleteLine && isHeading))) {
      const block = source.slice(blockStart, offset)
      if (block.trim()) blocks.push(block)
      blockStart = offset
    }
  }

  return { blocks, remainder: source.slice(blockStart) }
}

export function appendRevealedMarkdown(
  current: StreamingMarkdown,
  nextChunk: RevealedTextChunk,
): StreamingMarkdown {
  const pendingText = current.pendingChunks.map((chunk) => chunk.text).join('') + nextChunk.text
  const { blocks, remainder } = partitionStableMarkdown(pendingText)

  if (blocks.length === 0) {
    return { ...current, pendingChunks: [...current.pendingChunks, nextChunk] }
  }

  return {
    markdownBlocks: [...current.markdownBlocks, ...blocks],
    pendingChunks: remainder ? [{ id: nextChunk.id, text: remainder }] : [],
  }
}

export function finalizeStreamingMarkdown(current: StreamingMarkdown): StreamingMarkdown {
  const remainder = current.pendingChunks.map((chunk) => chunk.text).join('')
  if (!remainder) return current

  return {
    markdownBlocks: [...current.markdownBlocks, remainder],
    pendingChunks: [],
  }
}
