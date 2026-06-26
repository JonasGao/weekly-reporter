import { NextResponse } from 'next/server'
import { readdirSync, statSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'

const ALLOWED_BASE_DIRS = [
  process.env.HOME || '/home',
  '/opt',
  '/srv',
  '/var',
  '/tmp',
]

function isPathAllowed(path: string): boolean {
  const resolvedPath = resolve(path)
  return ALLOWED_BASE_DIRS.some(baseDir => resolvedPath.startsWith(baseDir))
}

function fuzzyMatch(name: string, query: string): boolean {
  const lowerName = name.toLowerCase()
  const lowerQuery = query.toLowerCase()
  if (lowerName.includes(lowerQuery)) return true
  let qi = 0
  for (let ni = 0; ni < lowerName.length && qi < lowerQuery.length; ni++) {
    if (lowerName[ni] === lowerQuery[qi]) qi++
  }
  return qi === lowerQuery.length
}

function fuzzyScore(name: string, query: string): number {
  const lowerName = name.toLowerCase()
  const lowerQuery = query.toLowerCase()
  if (lowerName === lowerQuery) return 100
  if (lowerName.startsWith(lowerQuery)) return 90
  if (lowerName.includes(lowerQuery)) return 80
  let qi = 0
  let consecutive = 0
  let maxConsecutive = 0
  let lastMatch = -2
  for (let ni = 0; ni < lowerName.length && qi < lowerQuery.length; ni++) {
    if (lowerName[ni] === lowerQuery[qi]) {
      if (ni === lastMatch + 1) { consecutive++; maxConsecutive = Math.max(maxConsecutive, consecutive) }
      else { consecutive = 1 }
      lastMatch = ni
      qi++
    }
  }
  if (qi < lowerQuery.length) return -1
  return maxConsecutive * 10 + (lowerName.length - lowerQuery.length)
}

function findExistingBase(inputPath: string): { basePath: string; query: string } | null {
  let current = inputPath
  const segments: string[] = []
  while (current !== '/' && current !== '') {
    const base = basename(current)
    if (base) segments.unshift(base)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  let lastExistingIndex = -1
  let lastExistingPath = ''
  for (let i = 0; i < segments.length; i++) {
    const testPath = i === 0 ? (segments[0].startsWith('/') ? segments[0] : '/' + segments[0]) : resolve('/', ...segments.slice(0, i + 1))
    if (existsSync(testPath)) {
      const stats = statSync(testPath)
      if (stats.isDirectory()) {
        lastExistingIndex = i
        lastExistingPath = testPath
      }
    }
  }
  if (lastExistingIndex >= 0) {
    const query = segments.slice(lastExistingIndex + 1).join('/')
    return { basePath: lastExistingPath, query }
  }
  return null
}

function collectDirs(basePath: string, query: string, maxDepth: number = 3, currentDepth: number = 0): { name: string; path: string; score: number }[] {
  if (currentDepth >= maxDepth) return []
  const results: { name: string; path: string; score: number }[] = []
  try {
    const entries = readdirSync(basePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.') && entry.name !== '.') continue
      const fullPath = resolve(basePath, entry.name)
      const score = fuzzyScore(entry.name, query)
      if (score >= 0) {
        results.push({ name: entry.name, path: fullPath, score })
      } else {
        const nested = collectDirs(fullPath, query, maxDepth, currentDepth + 1)
        results.push(...nested)
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return results
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || '/'

    const resolvedPath = resolve(path)

    if (!isPathAllowed(resolvedPath)) {
      return NextResponse.json(
        { error: '不允许访问此目录', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    if (existsSync(resolvedPath)) {
      const stats = statSync(resolvedPath)
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { error: '路径不是目录', code: 'NOT_DIRECTORY' },
          { status: 400 }
        )
      }

      const entries = readdirSync(resolvedPath, { withFileTypes: true })
      const directories = entries
        .filter(entry => entry.isDirectory())
        .filter(entry => !entry.name.startsWith('.') || entry.name === '.')
        .slice(0, 50)
        .map(entry => ({
          name: entry.name,
          path: resolve(resolvedPath, entry.name),
        }))

      return NextResponse.json({
        directories,
        path: resolvedPath,
        exists: true,
      })
    }

    const found = findExistingBase(resolvedPath)
    if (!found || !found.query.trim()) {
      return NextResponse.json({ directories: [], path: resolvedPath, exists: false })
    }

    if (!isPathAllowed(found.basePath)) {
      return NextResponse.json(
        { error: '不允许访问此目录', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const matched = collectDirs(found.basePath, found.query)
    matched.sort((a, b) => b.score - a.score)

    const directories = matched.slice(0, 50).map(m => ({ name: m.name, path: m.path }))

    return NextResponse.json({
      directories,
      path: resolvedPath,
      exists: false,
      fuzzyQuery: found.query,
      fuzzyBase: found.basePath,
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
      return NextResponse.json(
        { error: '无权限访问此目录', code: 'ACCESS_DENIED' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: '扫描目录失败', code: 'SCAN_ERROR' },
      { status: 500 }
    )
  }
}