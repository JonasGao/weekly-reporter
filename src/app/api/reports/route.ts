import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { desc, eq, between } from 'drizzle-orm'
import { reports, templates, rawEvents } from '@/lib/db/schema'
import { reportSchema } from '@/lib/validations'
import { renderTemplate } from '@/lib/template/render'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import { mapTagsToSectionType } from '@/lib/tags/mapper'
import { triggerAsyncScoring } from '@/lib/scoring'

export async function GET(request: Request) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    
    const offset = (page - 1) * pageSize
    
    const allReports = await db.query.reports.findMany({
      orderBy: [desc(reports.createdAt)],
      limit: pageSize,
      offset,
    })
    
    const totalResult = await db.select().from(reports)
    const total = totalResult.length
    
    return NextResponse.json({
      reports: allReports,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('[/api/reports] Error:', error)
    return NextResponse.json(
      { error: '获取周报列表失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb()
    const body = await request.json()
    
    const validated = reportSchema.parse(body)
    
    // Extract templateId and baseDate
    const { templateId, baseDate, weekStart, weekEnd } = validated
    let finalContent = validated.content || ''
    
    // Query events within the week range
    const weekStartDate = new Date(weekStart)
    const weekEndDate = new Date(weekEnd)

    const eventsToProcess = await db.select()
      .from(rawEvents)
      .where(
        between(rawEvents.eventTime, weekStartDate, weekEndDate)
      )
    
    // Map tags to sectionType for each event
    const processedEvents = await Promise.all(
      eventsToProcess.map(async (event) => {
        if (event.tags && event.tags.length > 0) {
          const mappedSectionType = await mapTagsToSectionType(event.tags)
          return { ...event, sectionType: mappedSectionType }
        }
        return event
      })
    )
    
    // If templateId is provided, render the template
    if (templateId) {
      let templateContent: string = ''
      
      // Handle official templates
      if (templateId.startsWith('official-')) {
        const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
        if (template) {
          templateContent = template.content
        }
      }
      // Handle user templates
      else if (templateId.startsWith('user-')) {
        const templateIdNum = parseInt(templateId.replace('user-', ''), 10)
        if (!isNaN(templateIdNum)) {
          const result = await db.select()
            .from(templates)
            .where(eq(templates.id, templateIdNum))
            .limit(1)
          if (result.length > 0) {
            templateContent = result[0].content
          }
        }
      }
      
      // Render template with processed events
      if (templateContent) {
        finalContent = renderTemplate(templateContent, {
          date: baseDate ? new Date(baseDate) : new Date(),
          events: processedEvents,
        })
      }
    }
    
    // Ensure we have content
    if (!finalContent) {
      return NextResponse.json(
        { error: '无法获取模板内容或未提供内容', code: 'TEMPLATE_ERROR' },
        { status: 400 }
      )
    }
    
    const now = new Date()
    const result = await db.insert(reports).values({
      title: validated.title,
      content: finalContent,
      weekStart: validated.weekStart,
      weekEnd: validated.weekEnd,
      createdAt: now,
      updatedAt: now,
    }).returning()
    
    if (result[0]) {
      triggerAsyncScoring(result[0].id).catch(err => {
        console.error('[reports] Async scoring failed:', err)
      })
    }

    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: '数据验证失败', code: 'VALIDATION_ERROR', details: error },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '创建周报失败', code: 'CREATE_ERROR' },
      { status: 500 }
    )
  }
}