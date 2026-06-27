import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { renderTemplate } from '@/lib/template/render'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params
    
    // Parse date query parameter
    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')
    
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
    
    // Fetch template content
    let templateContent: string
    
    if (templateId.startsWith('official-')) {
      // Official template - find in OFFICIAL_TEMPLATES
      const officialTemplate = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      if (!officialTemplate) {
        return NextResponse.json(
          { error: '模板不存在', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      templateContent = officialTemplate.content
    } else if (templateId.startsWith('user-')) {
      // User template - query database
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
    } else {
      return NextResponse.json(
        { error: '模板ID无效', code: 'INVALID_ID' },
        { status: 400 }
      )
    }
    
    // Render template with variables
    const renderedContent = renderTemplate(templateContent, { date: baseDate })
    
    return NextResponse.json({
      content: renderedContent,
      templateId,
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