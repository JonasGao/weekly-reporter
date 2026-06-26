import { NextResponse } from 'next/server'
import { readdirSync, statSync, existsSync } from 'fs'
import { resolve, basename } from 'path'

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
    
    if (!existsSync(resolvedPath)) {
      return NextResponse.json(
        { directories: [], path: resolvedPath, exists: false }
      )
    }
    
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