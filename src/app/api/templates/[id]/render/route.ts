import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates, TemplateConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate } from '@/lib/template/render'
import { extractViewConfig } from '@/lib/template/view-config'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params
    
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    const viewType = (url.searchParams.get('viewType') as 'leadership' | 'personal') || 'personal'
    
    let baseDate: Date
    if (dateParam) {
      baseDate = new Date(dateParam)
      if (isNaN(baseDate.getTime())) {
        return NextResponse.json(
          { error: '日期参数无效', code: 'INVALID_DATE' },
          { status: 400 }
        )
      }
    } else {
      baseDate = new Date()
    }
    
    let templateContent: string
    let templateConfig: TemplateConfig = {}

    if (templateId.startsWith('official-')) {
      const officialTemplate = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (!officialTemplate) {
        return NextResponse.json(
          { error: '模板不存在', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      templateContent = officialTemplate.content
      templateConfig = officialTemplate.config || {}
    } else if (templateId.startsWith('user-')) {
      const numericId = parseInt(templateId.replace('user-', ''))
      if (isNaN(numericId)) {
        return NextResponse.json(
          { error: '模板ID无效', code: 'INVALID_ID' },
          { status: 400 }
        )
      }

      const db = getDb()
      const template = await db.select().from(templates).where(eq(templates.id, numericId))

      if (template.length === 0) {
        return NextResponse.json(
          { error: '模板不存在', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }

      templateContent = template[0].content
      templateConfig = typeof template[0].config === 'string'
        ? JSON.parse(template[0].config)
        : (template[0].config as unknown as TemplateConfig) || {}
    } else {
      return NextResponse.json(
        { error: '模板ID无效', code: 'INVALID_ID' },
        { status: 400 }
      )
    }

    const viewConfig = extractViewConfig(templateConfig, viewType)

    const renderedContent = renderTemplate(templateContent, {
      date: baseDate,
      enabledSections: viewConfig.enabledSections,
      sectionTypeMap: templateConfig.sectionTypeMap,
    })

    return NextResponse.json({
      content: renderedContent,
      templateId,
      viewType,
      aiStyle: viewConfig.aiStyle,
      baseDate: baseDate.toISOString()
    })
  } catch (error) {
    console.error('Template render error:', error)
    return NextResponse.json(
      { 
        error: '模板渲染失败', 
        code: 'RENDER_ERROR', 
        details: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    )
  }
}