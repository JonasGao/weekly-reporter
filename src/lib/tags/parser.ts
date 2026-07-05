const TAG_REGEX = /#([\w\u4e00-\u9fa5]+)/g

export function parseTags(input: string): { content: string; tags: string[] } {
  const tags: string[] = []
  const content = input.replace(TAG_REGEX, (match, tag) => {
    tags.push(tag)
    return ''
  }).replace(/\s+/g, ' ').trim()
  
  return { content, tags }
}

export function highlightTags(input: string): string {
  return input.replace(TAG_REGEX, '<span class="bg-blue-100 px-1 rounded">#$1</span>')
}