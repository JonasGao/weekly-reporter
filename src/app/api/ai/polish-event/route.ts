import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import { polishEvent } from '@/lib/ai'
import { AIConfigError } from '@/lib/ai/provider'
import type { AIStyle } from '@/lib/db/schema'

interface PolishEventRequest {
  eventContent: string
  templateId?: number
  styleOverride?: AIStyle
}

export async function POST(request: Request) {
  try {
    const body: PolishEventRequest = await request.json()

    if (!body.eventContent || typeof body.eventContent !== 'string') {
      return NextResponse.json(
        { error: '事件内容不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    let styleConfig
    if (body.styleOverride) {
      styleConfig = await getAIStyle(body.styleOverride)
    } else if (body.templateId) {
      styleConfig = await getStyleFromTemplate(body.templateId)
    } else {
      styleConfig = await getAIStyle()
    }

    const polishedContent = await polishEvent(
      body.eventContent,
      styleConfig.systemPrompt,
      styleConfig.temperature
    )

    return NextResponse.json({
      polishedContent,
      style: styleConfig.label,
      message: '事件润色成功',
    })
  } catch (error) {
    console.error('POST /api/ai/polish-event error:', error)
    if (error instanceof AIConfigError) {
      return NextResponse.json(
        { error: error.message, code: 'AI_NOT_CONFIGURED' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '事件润色失败', code: 'POLISH_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}
