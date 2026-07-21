import { getDb, schema } from './db'
import { eq } from 'drizzle-orm'
import { scoreReport } from './ai'
import { getStyleFromReport } from './ai/style-helpers'
import type { ScoreStatus } from './db/schema'

export interface ScoreUpdate {
  reportId: number
  scoreStatus: ScoreStatus
  scoreStructure?: number | null
  scoreContent?: number | null
  scoreValue?: number | null
  scoreOverall?: number | null
  suggestions?: string[] | null
  scoreError?: string | null
}

type ScoreBroadcastCallback = (update: ScoreUpdate) => void

let broadcastCallback: ScoreBroadcastCallback | null = null

export function setScoreBroadcastCallback(callback: ScoreBroadcastCallback) {
  broadcastCallback = callback
}

export function broadcastScoreUpdate(update: ScoreUpdate) {
  if (broadcastCallback) {
    broadcastCallback(update)
  }
}

export async function triggerAsyncScoring(reportId: number) {
  const db = getDb()
  
  try {
    await db.update(schema.reports)
      .set({ scoreStatus: 'scoring' })
      .where(eq(schema.reports.id, reportId))
    
    broadcastScoreUpdate({
      reportId,
      scoreStatus: 'scoring'
    })
    
    const report = await db.query.reports.findFirst({
      where: eq(schema.reports.id, reportId)
    })
    
    if (!report) {
      throw new Error('Report not found')
    }
    
    const style = await getStyleFromReport(reportId)
    
    const result = await scoreReport({ content: report.content })
    
    const weightedScore = calculateWeightedScore(
      result.score,
      style.scoreWeights
    )
    
    const suggestions = result.suggestions.join('\n')
    const now = new Date()
    
    await db.update(schema.reports)
      .set({
        scoreStatus: 'completed',
        scoreStructure: weightedScore.structure,
        scoreContent: weightedScore.content,
        scoreValue: weightedScore.value,
        scoreOverall: weightedScore.overall,
        suggestions,
        scoreError: null,
        scoredAt: now
      })
      .where(eq(schema.reports.id, reportId))
    
    broadcastScoreUpdate({
      reportId,
      scoreStatus: 'completed',
      scoreStructure: weightedScore.structure,
      scoreContent: weightedScore.content,
      scoreValue: weightedScore.value,
      scoreOverall: weightedScore.overall,
      suggestions: result.suggestions
    })
    
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await db.update(schema.reports)
      .set({
        scoreStatus: 'failed',
        scoreError: errorMessage
      })
      .where(eq(schema.reports.id, reportId))
    
    broadcastScoreUpdate({
      reportId,
      scoreStatus: 'failed',
      scoreError: errorMessage
    })
    
    return { success: false, error: errorMessage }
  }
}

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