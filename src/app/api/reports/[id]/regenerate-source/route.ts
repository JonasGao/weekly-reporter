import { NextResponse } from 'next/server'
import { regenerateSourceDrafts } from '@/lib/reports/service'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const bundle = await regenerateSourceDrafts(reportId)
    if (!bundle) {
      return NextResponse.json({ error: '周报不存在', code: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json(bundle)
  } catch (error) {
    console.error('POST /api/reports/[id]/regenerate-source error:', error)
    return NextResponse.json({ error: '重新生成原稿失败', code: 'REGENERATE_ERROR' }, { status: 500 })
  }
}
