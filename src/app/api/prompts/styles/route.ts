import { NextResponse } from 'next/server'
import { listAIStyles, createAIStyle } from '@/lib/ai/styles'
import { aiStyleSchema } from '@/lib/validations'
import { ensureSeed } from '@/lib/ai/seed'

export async function GET() {
  try {
    await ensureSeed()
    const styles = await listAIStyles()
    return NextResponse.json({ styles })
  } catch (error) {
    console.error('GET /api/prompts/styles error:', error)
    return NextResponse.json(
      { error: '获取风格列表失败', code: 'FETCH_ERROR' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = aiStyleSchema.parse(body)

    const style = await createAIStyle(validated)

    return NextResponse.json({ style }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { error: '创建风格失败', code: 'CREATE_ERROR' },
      { status: 500 },
    )
  }
}
