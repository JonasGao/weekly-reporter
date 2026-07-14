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

/**
 * 归一化 git remote URL 为 owner/repo 格式
 * 支持格式：
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - ssh://git@github.com/owner/repo.git
 * - https://gitlab.com/owner/repo
 * - 自托管服务：git.company.com/team/project
 */
export function normalizeRepoName(urlOrPath: string): string {
  if (!urlOrPath || urlOrPath.trim() === '') {
    return ''
  }

  let normalized = urlOrPath.trim()

  // 去掉尾部斜杠
  normalized = normalized.replace(/\/+$/, '')

  // 去掉 .git 后缀
  normalized = normalized.replace(/\.git$/, '')

  // 处理 SSH 格式：git@host:owner/repo -> owner/repo
  const sshMatch = normalized.match(/^(?:[^@]+@)?[^:]+:(.+)$/)
  if (sshMatch) {
    normalized = sshMatch[1]
  } else {
    // 处理 URL 格式：protocol://[user@]host/owner/repo -> owner/repo
    normalized = normalized.replace(/^(?:https?|ssh|git):\/\//, '')
    normalized = normalized.replace(/^[^@/]+@/, '')
    // 去掉 host 部分
    const slashIndex = normalized.indexOf('/')
    if (slashIndex !== -1) {
      normalized = normalized.substring(slashIndex + 1)
    }
  }

  // 如果包含路径，返回完整的 owner/repo
  const parts = normalized.split('/')
  if (parts.length >= 2) {
    const owner = parts[parts.length - 2]
    const repo = parts[parts.length - 1]
    return `${owner}/${repo}`
  }

  // 如果无法解析为 owner/repo，返回原始值（可能是纯目录名）
  return parts[parts.length - 1] || normalized
}
