import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import type { AIStyle } from '@/lib/db/schema'

interface ExpandSectionRequest {
  sectionTitle: string
  existingItems: string[]
  events: string[]
  templateId?: number
  styleOverride?: AIStyle
}

interface ExpandedItem {
  content: string
  source: 'existing' | 'generated'
}

/**
 * Placeholder function for OpenAI expand API call
 * Will be replaced with real OpenAI integration later
 */
async function callOpenAIForExpand(
  sectionTitle: string,
  existingItems: string[],
  events: string[],
  systemPrompt: string,
  temperature: number
): Promise<ExpandedItem[]> {
  // TODO: Implement real OpenAI API call
  // For now, return placeholder items
  const results: ExpandedItem[] = existingItems.map(item => ({
    content: item,
    source: 'existing' as const,
  }))
  
  // Add a placeholder generated item
  results.push({
    content: `[AI生成] 基于 ${events.length} 个事件的新条目`,
    source: 'generated' as const,
  })
  
  return results
}

export async function POST(request: Request) {
  try {
    const body: ExpandSectionRequest = await request.json()
    
    // Validate required fields
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

    // Get style configuration
    let styleConfig
    if (body.templateId) {
      styleConfig = await getStyleFromTemplate(body.templateId)
    } else if (body.styleOverride) {
      styleConfig = getAIStyle(body.styleOverride)
    } else {
      styleConfig = getAIStyle() // Default style
    }

    // Call OpenAI API for expansion
    const expandedItems = await callOpenAIForExpand(
      body.sectionTitle,
      body.existingItems,
      body.events,
      styleConfig.systemPrompt,
      styleConfig.temperature
    )

    // Count added items
    const addedCount = expandedItems.filter(item => item.source === 'generated').length

    return NextResponse.json({
      expandedItems,
      addedCount,
      message: `成功扩展 ${addedCount} 个新条目`,
    })
  } catch (error) {
    console.error('POST /api/ai/expand-section error:', error)
    return NextResponse.json(
      { error: '章节扩展失败', code: 'EXPAND_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}