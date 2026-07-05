import { NextResponse } from 'next/server'
import { renderTemplate } from '@/lib/template/render'
import { extractViewConfig } from '@/lib/template/view-config'
import { OFFICIAL_TEMPLATES } from '@/lib/official-templates'
import { TemplateConfig } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const { content, templateId, viewType, format = 'markdown' } = await request.json()

    if (!content || !templateId || !viewType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    let templateConfig: TemplateConfig = {}

    if (templateId.startsWith('official-')) {
      const template = OFFICIAL_TEMPLATES.find(t => t.id === templateId)
      templateConfig = template?.config || {}
    }

    const viewConfig = extractViewConfig(templateConfig, viewType)

    const exportContent = renderTemplate(content, {
      enabledSections: viewConfig.enabledSections,
      sectionTypeMap: templateConfig.sectionTypeMap,
    })

    return NextResponse.json({
      content: exportContent,
      viewType,
      format,
      aiStyle: viewConfig.aiStyle,
    })
  } catch (error) {
    return NextResponse.json(
      { error: '导出失败', details: String(error) },
      { status: 500 }
    )
  }
}
