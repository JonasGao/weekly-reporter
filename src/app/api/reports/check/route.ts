import { NextResponse } from 'next/server'
import { checkContent, scoreReport } from '@/lib/ai'
import { getStyleFromReport, getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 如果有 section 字段，说明是区块实时检查
    if (body.section) {
      const result = await checkContent(body)
      return NextResponse.json(result)
    }

    // 否则是全文评分
    const { templateId, reportId, styleOverride, content } = body

    // Get AI style configuration
    let style
    if (styleOverride) {
      style = await getAIStyle(styleOverride)
    } else if (reportId) {
      style = await getStyleFromReport(reportId)
    } else if (templateId) {
      style = await getStyleFromTemplate(templateId)
    } else {
      style = await getAIStyle()
    }

    // Get raw scores from AI
    const result = await getRawScoresFromAI(content, style)

    // Apply style-based weights to calculate total score
    const weightedScore = calculateWeightedScore(result.score, style.scoreWeights)

    return NextResponse.json({
      ...result,
      score: weightedScore,
    })
  } catch (error) {
    return NextResponse.json({
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['检查失败'],
    })
  }
}

/**
 * Get raw scores from AI (placeholder implementation)
 * This should be replaced with actual AI integration
 */
async function getRawScoresFromAI(content: string, style: any) {
  // Delegate to existing scoreReport function
  // In future, this should incorporate style-specific prompts
  return await scoreReport({ content })
}

/**
 * Calculate weighted score based on style weights
 */
function calculateWeightedScore(
  rawScore: { structure: number; content: number; value: number; overall: number },
  weights: { structure: number; content: number; value: number }
) {
  const weightedOverall =
    rawScore.structure * weights.structure +
    rawScore.content * weights.content +
    rawScore.value * weights.value

  return {
    structure: rawScore.structure,
    content: rawScore.content,
    value: rawScore.value,
    overall: Math.round(weightedOverall),
  }
}