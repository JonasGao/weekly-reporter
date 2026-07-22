import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import { unifyStyle } from '@/lib/ai'
import { AIConfigError } from '@/lib/ai/provider'
import type { AIStyle } from '@/lib/db/schema'

interface UnifyStyleRequest {
  reportContent: string
  templateId?: number
  styleOverride?: AIStyle
}

export async function POST(request: Request) {
  try {
    const body: UnifyStyleRequest = await request.json()

    if (!body.reportContent || typeof body.reportContent !== 'string') {
      return NextResponse.json(
        { error: '报告内容不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    let styleConfig
    if (body.templateId) {
      styleConfig = await getStyleFromTemplate(body.templateId)
    } else if (body.styleOverride) {
      styleConfig = await getAIStyle(body.styleOverride)
    } else {
      styleConfig = await getAIStyle()
    }

    const { unifiedContent, changesCount } = await unifyStyle(
      body.reportContent,
      styleConfig.systemPrompt,
      styleConfig.temperature
    )

    return NextResponse.json({
      unifiedContent,
      changesCount,
      message: `成功统一风格，共修改 ${changesCount} 处`,
    })
  } catch (error) {
    console.error('POST /api/ai/unify-style error:', error)
    if (error instanceof AIConfigError) {
      return NextResponse.json(
        { error: error.message, code: 'AI_NOT_CONFIGURED' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '风格统一失败', code: 'UNIFY_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}
