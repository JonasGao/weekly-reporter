import { NextResponse } from 'next/server'
import { checkContent, scoreReport } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 如果有 section 字段，说明是区块实时检查
    if (body.section) {
      const result = await checkContent(body)
      return NextResponse.json(result)
    }

    // 否则是全文评分
    const result = await scoreReport(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['检查失败'],
    })
  }
}