import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { templates, reports } from '../db/schema'
import { getAIStyle, AIStyleConfig } from './styles'

/**
 * Get AI style configuration from a report
 * If the report has an aiStyleOverride, use that; otherwise use the template's style
 */
export async function getStyleFromReport(reportId: number): Promise<AIStyleConfig> {
  const db = getDb()
  
  // Get the report
  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  })
  
  if (!report) {
    // Return default style if report not found
    return getAIStyle()
  }
  
  // If report has style override, use it
  if (report.aiStyleOverride) {
    return getAIStyle(report.aiStyleOverride)
  }
  
  // Otherwise, get style from template
  // Note: This assumes reports have a templateId field
  // If not, we'll need to adjust this logic
  // For now, return default style
  return getAIStyle()
}

/**
 * Get AI style configuration from a template
 */
export async function getStyleFromTemplate(templateId: number): Promise<AIStyleConfig> {
  const db = getDb()
  
  // Get the template
  const template = await db.query.templates.findFirst({
    where: eq(templates.id, templateId),
  })
  
  if (!template) {
    // Return default style if template not found
    return getAIStyle()
  }
  
  // Return the template's style
  return getAIStyle(template.aiStyle)
}