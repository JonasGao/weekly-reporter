import { NextResponse } from 'next/server'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'
import type { AIStyle } from '@/lib/db/schema'

interface UnifyStyleRequest {
  reportContent: string
  templateId?: number
  styleOverride?: AIStyle
}

interface StyleChange {
  original: string
  modified: string
  type: 'wording' | 'structure' | 'tone'
}

/**
 * Placeholder function for OpenAI unify API call
 * Will be replaced with real OpenAI integration later
 */
async function callOpenAIForUnify(
  content: string,
  systemPrompt: string,
  temperature: number
): Promise<{ unifiedContent: string; changes: StyleChange[] }> {
  // TODO: Implement real OpenAI API call
  // For now, return a placeholder response
  return {
    unifiedContent: `[统一风格后] ${content}`,
    changes: [
      {
        original: '原文片段1',
        modified: '修改后片段1',
        type: 'wording',
      },
    ],
  }
}

export async function POST(request: Request) {
  try {
    const body: UnifyStyleRequest = await request.json()
    
    // Validate required fields
    if (!body.reportContent || typeof body.reportContent !== 'string') {
      return NextResponse.json(
        { error: '报告内容不能为空', code: 'INVALID_INPUT' },
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

    // Call OpenAI API for unification
    const { unifiedContent, changes } = await callOpenAIForUnify(
      body.reportContent,
      styleConfig.systemPrompt,
      styleConfig.temperature
    )

    return NextResponse.json({
      unifiedContent,
      changesCount: changes.length,
      message: `成功统一风格，共修改 ${changes.length} 处`,
    })
  } catch (error) {
    console.error('POST /api/ai/unify-style error:', error)
    return NextResponse.json(
      { error: '风格统一失败', code: 'UNIFY_ERROR', details: String(error) },
      { status: 500 }
    )
  }
}