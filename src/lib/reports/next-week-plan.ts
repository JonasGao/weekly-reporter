export type NextWeekPlanParseResult =
  | {
      status: 'found'
      items: string[]
      warning?: string
      sectionCount: number
      sectionLevel: 2 | 3
    }
  | {
      status: 'missing'
      reason: string
    }
  | {
      status: 'empty'
      reason: string
    }
  | {
      status: 'failed'
      reason: string
    }

interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6
  title: string
}

interface PlanSection {
  heading: Heading
  lines: string[]
}

export type TimelinePlanProjection = {
  audience: 'leadership' | 'personal'
  status: 'found' | 'no-source' | 'no-plan' | 'parse-failed'
  items: string[]
  source?: {
    reportId: number
    title: string
    weekStart: string
    weekEnd: string
    audience: 'leadership' | 'personal'
    finalStatus: 'current'
  }
  warning?: string
  reason?: string
}

const NEXT_WEEK_PLAN_TITLE = '下周计划'
const headingPattern = /^( {0,3})(#{1,6})(?:[ \t]+|$)(.*?)[ \t]*#*[ \t]*$/
const listPattern = /^\s*(?:[-*+])[ \t]+(.+?)\s*$/

function parseHeading(line: string): Heading | null {
  const match = line.match(headingPattern)
  if (!match) return null
  const level = match[2].length as Heading['level']
  return { level, title: match[3].trim() }
}

function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line)
}

function sectionLines(lines: string[], headingIndex: number, heading: Heading): string[] {
  const content: string[] = []
  let fenced = false
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (isFence(line)) {
      fenced = !fenced
      continue
    }
    if (!fenced) {
      const nextHeading = parseHeading(line)
      if (nextHeading && nextHeading.level <= heading.level) break
    }
    content.push(line)
  }
  return content
}

/**
 * Parse the first level-2/3 “下周计划” section from a final report.
 * The parser intentionally only considers unordered list items inside the
 * section and never infers plans from prose or other headings.
 */
export function parseNextWeekPlan(content: string): NextWeekPlanParseResult {
  const lines = content.split(/\r?\n/)
  const sections: PlanSection[] = []
  let fenced = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isFence(line)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const heading = parseHeading(line)
    if (!heading || (heading.level !== 2 && heading.level !== 3)) continue
    if (heading.title.toLocaleLowerCase() !== NEXT_WEEK_PLAN_TITLE.toLocaleLowerCase()) continue

    sections.push({ heading, lines: sectionLines(lines, index, heading) })
  }

  if (sections.length === 0) {
    return {
      status: 'missing',
      reason: 'No level-2 or level-3 “下周计划” section was found.',
    }
  }

  const first = sections[0]
  const items: string[] = []
  let fencedSection = false
  for (const line of first.lines) {
    if (isFence(line)) {
      fencedSection = !fencedSection
      continue
    }
    if (fencedSection) continue
    const match = line.match(listPattern)
    if (match) items.push(match[1].trim())
  }

  if (items.length === 0) {
    const hasVisibleContent = first.lines.some((line) => line.trim().length > 0)
    return hasVisibleContent
      ? {
          status: 'failed',
          reason: 'The “下周计划” section contains no recognizable -, * or + unordered list.',
        }
      : {
          status: 'empty',
          reason: 'The “下周计划” section is present but contains no plan items.',
        }
  }

  return {
    status: 'found',
    items,
    sectionCount: sections.length,
    sectionLevel: first.heading.level as 2 | 3,
    ...(sections.length > 1
      ? { warning: `Found ${sections.length} matching “下周计划” sections; only the first was used.` }
      : {}),
  }
}
