import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import { expandSection } from '@/lib/ai'
import { AIConfigError } from '@/lib/ai/provider'
import type { AIStyle } from '@/lib/db/schema'

interface ExpandSectionRequest {
  sectionTitle: string
  existingItems: string[]
  events: string[]
  templateId?: number
  styleOverride?: AIStyle
}

export async function POST(request: Request) {
  try {
    const body: ExpandSectionRequest = await request.json()

    if (!body.sectionTitle || typeof body.sectionTitle !== 'string') {
      return NextResponse.json(
        { error: '章节标题不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.existingItems)) {
      return NextResponse.json(
        { error: '现有条目必须为数组', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.events)) {
      return NextResponse.json(
        { error: '事件列表必须为数组', code: 'INVALID_INPUT' },
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

    const expandedItems = await expandSection(
      body.sectionTitle,
      body.existingItems,
      body.events,
      styleConfig.systemPrompt,
      styleConfig.temperature
    )

    const addedCount = expandedItems.filter(item => item.source === 'generated').length

    return NextResponse.json({
      expandedItems,
      addedCount,
      message: `成功扩展 ${addedCount} 个新条目`,
    })
  } catch (error) {
    console.error('POST /api/ai/expand-section error:', error)
    if (error instanceof AIConfigError) {
      return NextResponse.json(
        { error: error.message, code: 'AI_NOT_CONFIGURED' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '章节扩展失败', code: 'EXPAND_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}
