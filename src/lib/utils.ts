import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, startOfWeek, endOfWeek } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return { start, end }
}

export function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const lines = content.split('\n')
  let currentSection = ''

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim()
      sections[currentSection] = ''
    } else if (currentSection) {
      sections[currentSection] += line + '\n'
    }
  }

  return sections
}

export function getSectionStatus(content: string): Record<string, 'empty' | 'short' | 'good'> {
  const sections = parseSections(content)
  const status: Record<string, 'empty' | 'short' | 'good'> = {}

  for (const [name, sectionContent] of Object.entries(sections)) {
    const trimmed = sectionContent.trim()
    if (trimmed.length === 0) {
      status[name] = 'empty'
    } else if (trimmed.length < 20) {
      status[name] = 'short'
    } else {
      status[name] = 'good'
    }
  }

  return status
}
