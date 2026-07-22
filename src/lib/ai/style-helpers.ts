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

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  })

  if (!report) {
    return getAIStyle()
  }

  if (report.aiStyleOverride) {
    return getAIStyle(report.aiStyleOverride)
  }

  return getAIStyle()
}

/**
 * Get AI style configuration from a template
 */
export async function getStyleFromTemplate(templateId: number): Promise<AIStyleConfig> {
  const db = getDb()

  const template = await db.query.templates.findFirst({
    where: eq(templates.id, templateId),
  })

  if (!template) {
    return getAIStyle()
  }

  return getAIStyle(template.aiStyle)
}
