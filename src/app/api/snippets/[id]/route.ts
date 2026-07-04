import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { sentenceSnippets } from '@/lib/db/schema'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const snippetId = parseInt(id, 10)
    
    // Validate ID
    if (isNaN(snippetId)) {
      return NextResponse.json(
        { error: '无效的片段ID', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    // Check if snippet exists and get its details
    const snippet = await db.query.sentenceSnippets.findFirst({
      where: eq(sentenceSnippets.id, snippetId),
    })
    
    if (!snippet) {
      return NextResponse.json(
        { error: '句子片段不存在', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    // Check if it's a built-in snippet
    if (snippet.isBuiltIn) {
      return NextResponse.json(
        { error: '内置片段不能删除', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
    
    // Delete the snippet
    await db.delete(sentenceSnippets).where(eq(sentenceSnippets.id, snippetId))
    
    return NextResponse.json({
      message: '句子片段删除成功',
    })
  } catch (error) {
    console.error('DELETE /api/snippets/[id] error:', error)
    return NextResponse.json(
      { error: '删除句子片段失败', code: 'DELETE_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}