import { NextResponse } from 'next/server'
import { getAIStyle } from '@/lib/ai/styles'
import { generateFinalReport } from '@/lib/ai'
import { AIConfigError } from '@/lib/ai/provider'
import { getReportBundle, getTemplateSelection } from '@/lib/reports/service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const reportId = Number.parseInt((await params).id, 10)
    if (Number.isNaN(reportId)) {
      return NextResponse.json({ error: '无效的周报ID', code: 'INVALID_ID' }, { status: 400 })
    }

    const body = await request.json()
    const variant = body.variant === 'leadership' || body.variant === 'personal' ? body.variant : null
    if (!variant || typeof body.templateId !== 'string' || !body.templateId) {
      return NextResponse.json({ error: '必须选择受众版本和模板', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const bundle = await getReportBundle(reportId)
    if (!bundle) {
      return NextResponse.json({ error: '周报不存在', code: 'NOT_FOUND' }, { status: 404 })
    }

    const reportVariant = bundle.variants.find((item) => item.variant === variant)
    if (!reportVariant) {
      return NextResponse.json({ error: '周报版本不存在', code: 'VARIANT_NOT_FOUND' }, { status: 404 })
    }
    if (reportVariant.sourceRevision === 0 || reportVariant.sourceDraft === '- 本周暂无事件') {
      return NextResponse.json({ error: '没有可用于生成终版的事件', code: 'EMPTY_SOURCE_DRAFT' }, { status: 400 })
    }

    const template = await getTemplateSelection(body.templateId)
    if (!template) {
      return NextResponse.json({ error: '模板不存在', code: 'TEMPLATE_NOT_FOUND' }, { status: 404 })
    }

    const styleKey = typeof body.styleOverride === 'string' && body.styleOverride
      ? body.styleOverride
      : template.aiStyle
    const style = await getAIStyle(styleKey)
    const effectiveStyleKey = typeof body.styleOverride === 'string' && body.styleOverride
      ? body.styleOverride
      : template.aiStyle
    const result = await generateFinalReport({
      sourceDraft: reportVariant.sourceDraft,
      template: template.content,
      variant,
      weekStart: bundle.weekStart,
      weekEnd: bundle.weekEnd,
      stylePrompt: style.systemPrompt,
    }, style.temperature)

    return NextResponse.json({
      content: result.content,
      summary: result.summary,
      variant,
      template,
      aiStyle: effectiveStyleKey,
      sourceRevision: reportVariant.sourceRevision,
    })
  } catch (error) {
    console.error('POST /api/reports/[id]/generate error:', error)
    if (error instanceof AIConfigError) {
      return NextResponse.json({ error: error.message, code: 'AI_NOT_CONFIGURED' }, { status: 400 })
    }
    return NextResponse.json(
      { error: '终版生成失败', code: 'GENERATION_ERROR', details: String(error) },
      { status: 500 },
    )
  }
}
