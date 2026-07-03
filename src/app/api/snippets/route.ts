import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { sentenceSnippets } from '@/lib/db/schema'

interface SnippetQuery {
  category?: string
}

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    
    // Build query with optional category filter
    let query = db.select().from(sentenceSnippets)
    
    if (category) {
      query = query.where(eq(sentenceSnippets.category, category))
    }
    
    const snippets = await query
    
    return NextResponse.json({
      snippets,
    })
  } catch (error) {
    console.error('GET /api/snippets error:', error)
    return NextResponse.json(
      { error: '获取句子片段失败', code: 'FETCH_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: '内容不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }
    
    // Validate content length
    if (body.content.length > 500) {
      return NextResponse.json(
        { error: '内容长度不能超过500个字符', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }
    
    // Validate category if provided
    if (body.category && typeof body.category !== 'string') {
      return NextResponse.json(
        { error: '分类必须为字符串', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const result = await db.insert(sentenceSnippets).values({
      content: body.content,
      category: body.category || '通用',
      isBuiltIn: false, // User-created snippets are never built-in
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    return NextResponse.json({ snippet: result[0] }, { status: 201 })
  } catch (error) {
    console.error('POST /api/snippets error:', error)
    return NextResponse.json(
      { error: '创建句子片段失败', code: 'CREATE_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}