// Built via `new RegExp` so TypeScript's ES2017 regex parser doesn't reject `\p{Script=Han}`.
// (`\p{Han}` bare form is rejected by the Node 24 / V8 runtime — must use `Script=Han`.)
export const TAG_CHARSET_REGEX = new RegExp('^[\\p{Script=Han}A-Za-z0-9]+$', 'u')

const TAG_MATCH_REGEX = new RegExp('(?:^|\\s)#([\\p{Script=Han}A-Za-z0-9]+)(?=\\s|$)', 'gu')

export function parseTags(content: string): string[] {
  const set = new Set<string>()
  for (const match of content.matchAll(TAG_MATCH_REGEX)) {
    set.add(match[1])
  }
  return [...set]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function removeTagFromContent(content: string, tagName: string): string {
  const re = new RegExp('(^|\\s+)(#' + escapeRegex(tagName) + ')(?=\\s|$)', 'gu')
  const matches = [...content.matchAll(re)]
  if (matches.length === 0) return content

  let result = content
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const start = m.index!
    const end = start + m[0].length

    // Consume all trailing whitespace after the tag (the lookahead didn't consume it).
    let siteEnd = end
    while (siteEnd < result.length && /\s/.test(result[siteEnd])) {
      siteEnd++
    }

    // `start` is already at the first whitespace of the leading boundary (the
    // regex's `(^|\s+)` group is included in m[0]).

    let replacement: string
    if (start === 0 && siteEnd >= result.length) {
      replacement = ''
    } else if (start === 0) {
      replacement = ''
    } else if (siteEnd >= result.length) {
      replacement = ''
    } else {
      replacement = ' '
    }

    result = result.slice(0, start) + replacement + result.slice(siteEnd)
  }

  return result.trim()
}

export function renameTagInContent(content: string, oldName: string, newName: string): string {
  const re = new RegExp('(^|\\s+)(#)(' + escapeRegex(oldName) + ')(?=\\s|$)', 'gu')
  return content.replace(re, (_match, boundary, hash) => boundary + hash + newName)
}
