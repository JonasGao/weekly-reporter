import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import type { AIStyle } from '@/lib/db/schema'

interface PolishEventRequest {
  eventContent: string
  templateId?: number
  styleOverride?: AIStyle
}

/**
 * Placeholder function for OpenAI polish API call
 * Will be replaced with real OpenAI integration later
 */
async function callOpenAIForPolish(
  content: string,
  systemPrompt: string,
  temperature: number
): Promise<string> {
  // TODO: Implement real OpenAI API call
  // For now, return a placeholder response
  return `[润色后] ${content}`
}

export async function POST(request: Request) {
  try {
    const body: PolishEventRequest = await request.json()
    
    // Validate required fields
    if (!body.eventContent || typeof body.eventContent !== 'string') {
      return NextResponse.json(
        { error: '事件内容不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    // Get style configuration
    // Priority: styleOverride (explicit user choice) > templateId > default
    let styleConfig
    if (body.styleOverride) {
      styleConfig = getAIStyle(body.styleOverride)
    } else if (body.templateId) {
      styleConfig = await getStyleFromTemplate(body.templateId)
    } else {
      styleConfig = getAIStyle() // Default style
    }

    // Call OpenAI API for polishing
    const polishedContent = await callOpenAIForPolish(
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
    return NextResponse.json(
      { error: '事件润色失败', code: 'POLISH_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}