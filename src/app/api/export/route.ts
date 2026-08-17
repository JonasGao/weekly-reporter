import { NextResponse } from 'next/server'

/** Export already-selected source/final content; no template rendering occurs. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: '导出内容不能为空', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const variant = body.variant === 'leadership' ? 'leadership' : 'personal'
    return NextResponse.json({ content: body.content, variant, format: body.format ?? 'markdown' })
  } catch {
    return NextResponse.json({ error: '导出失败', code: 'EXPORT_ERROR' }, { status: 500 })
  }
}
