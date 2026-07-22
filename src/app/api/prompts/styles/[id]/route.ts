import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { aiStyles } from '@/lib/db/schema'
import { updateAIStyle, deleteAIStyle, setDefaultStyle } from '@/lib/ai/styles'
import { aiStyleSchema } from '@/lib/validations'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const db = getDb()
    const { id } = await params
    const result = await db.select().from(aiStyles).where(eq(aiStyles.id, parseInt(id)))

    if (result.length === 0) {
      return NextResponse.json(
        { error: '风格不存在', code: 'STYLE_NOT_FOUND' },
        { status: 404 },
      )
    }

    return NextResponse.json({ style: result[0] })
  } catch (error) {
    return NextResponse.json(
      { error: '获取风格失败', code: 'FETCH_ERROR' },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()

    const validated = aiStyleSchema.partial().parse(body)

    const style = await updateAIStyle(parseInt(id), validated)

    if (!style) {
      return NextResponse.json(
        { error: '风格不存在', code: 'STYLE_NOT_FOUND' },
        { status: 404 },
      )
    }

    return NextResponse.json({ style })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: '更新风格失败', code: 'UPDATE_ERROR' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const result = await deleteAIStyle(parseInt(id))

    if (!result.success) {
      const status = result.error === '风格不存在' ? 404 : 400
      return NextResponse.json(
        { error: result.error, code: 'DELETE_ERROR' },
        { status },
      )
    }

    return NextResponse.json({ success: true, message: '风格已删除' })
  } catch (error) {
    return NextResponse.json(
      { error: '删除风格失败', code: 'DELETE_ERROR' },
      { status: 500 },
    )
  }
}

/** PATCH: 设为默认风格 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const style = await setDefaultStyle(parseInt(id))

    if (!style) {
      return NextResponse.json(
        { error: '风格不存在', code: 'STYLE_NOT_FOUND' },
        { status: 404 },
      )
    }

    return NextResponse.json({ style, message: '已设为默认风格' })
  } catch (error) {
    return NextResponse.json(
      { error: '设置默认风格失败', code: 'UPDATE_ERROR' },
      { status: 500 },
    )
  }
}
