import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAIConfig, updateModelListCache } from '@/lib/ai/config'
import { fetchModelList } from '@/lib/ai/provider'

export async function GET() {
  try {
    const db = getDb()
    const config = await getAIConfig(db)

    if (!config) {
      return NextResponse.json(
        { error: 'AI 未配置', code: 'AI_NOT_CONFIGURED' },
        { status: 400 }
      )
    }

    if (config.protocol === 'anthropic') {
      return NextResponse.json({
        models: [],
        supported: false,
        message: 'Anthropic 协议不支持自动拉取模型列表，请手动输入模型名称',
      })
    }

    const models = await fetchModelList(config)
    await updateModelListCache(db, models)

    return NextResponse.json({
      models,
      supported: true,
      cachedAt: new Date(),
    })
  } catch (error) {
    console.error('GET /api/settings/ai/models error:', error)
    const db = getDb()
    const config = await getAIConfig(db)
    const cachedModels = config?.modelListCache ?? []

    return NextResponse.json({
      models: cachedModels,
      supported: true,
      cached: cachedModels.length > 0,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
