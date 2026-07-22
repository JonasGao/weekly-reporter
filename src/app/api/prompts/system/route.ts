import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { systemPrompts } from '@/lib/db/schema'
import { systemPromptSchema } from '@/lib/validations'
import { ensureSeed } from '@/lib/ai/seed'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    await ensureSeed()
    const db = getDb()
    const prompts = await db.select().from(systemPrompts).orderBy(systemPrompts.key)

    return NextResponse.json({ prompts })
  } catch (error) {
    console.error('GET /api/prompts/system error:', error)
    return NextResponse.json(
      { error: '获取系统提示词失败', code: 'FETCH_ERROR' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    const validated = systemPromptSchema.parse(body)
    const key = body.key

    if (!key || !['check', 'score'].includes(key)) {
      return NextResponse.json(
        { error: '无效的提示词 key', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const now = new Date()
    const existing = await db.select().from(systemPrompts).where(eq(systemPrompts.key, key))

    if (existing.length === 0) {
      return NextResponse.json(
        { error: '系统提示词不存在', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    await db.update(systemPrompts)
      .set({ promptText: validated.promptText, updatedAt: now })
      .where(eq(systemPrompts.key, key))

    const updated = await db.select().from(systemPrompts).where(eq(systemPrompts.key, key))

    return NextResponse.json({ prompt: updated[0] })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: '更新系统提示词失败', code: 'UPDATE_ERROR' },
      { status: 500 },
    )
  }
}
