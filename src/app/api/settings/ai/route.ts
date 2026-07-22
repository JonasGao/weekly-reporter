import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAIConfig, saveAIConfig, clearAIConfig } from '@/lib/ai/config'
import type { AIProtocol } from '@/lib/db/schema'

export async function GET() {
  try {
    const db = getDb()
    const config = await getAIConfig(db)

    if (!config) {
      return NextResponse.json({ configured: false })
    }

    return NextResponse.json({
      configured: true,
      protocol: config.protocol,
      apiUrl: config.apiUrl,
      apiKeyConfigured: !!config.apiKey,
      model: config.model,
      modelListCache: config.modelListCache,
      modelListCachedAt: config.modelListCachedAt,
    })
  } catch (error) {
    console.error('GET /api/settings/ai error:', error)
    return NextResponse.json(
      { error: '获取 AI 配置失败', code: 'FETCH_ERROR' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { protocol, apiUrl, apiKey, model } = body

    if (!apiUrl || typeof apiUrl !== 'string') {
      return NextResponse.json(
        { error: 'API URL 不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    try {
      new URL(apiUrl)
    } catch {
      return NextResponse.json(
        { error: 'API URL 格式无效', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    const db = getDb()
    const existingConfig = await getAIConfig(db)

    // If apiKey is empty but a key was previously configured, reuse the existing key.
    // This allows users to change just the model without re-entering the API key.
    const effectiveApiKey =
      apiKey && typeof apiKey === 'string' ? apiKey : existingConfig?.apiKey

    if (!effectiveApiKey || typeof effectiveApiKey !== 'string') {
      return NextResponse.json(
        { error: 'API Key 不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    // If model is empty but one was previously configured, reuse the existing model.
    const effectiveModel =
      model && typeof model === 'string' ? model : existingConfig?.model

    if (!effectiveModel || typeof effectiveModel !== 'string') {
      return NextResponse.json(
        { error: '模型名称不能为空', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    if (protocol && !['openai', 'openai-compatible', 'anthropic'].includes(protocol)) {
      return NextResponse.json(
        { error: '协议格式无效', code: 'INVALID_INPUT' },
        { status: 400 }
      )
    }

    const saved = await saveAIConfig(db, {
      protocol: (protocol as AIProtocol) ?? 'openai-compatible',
      apiUrl,
      apiKey: effectiveApiKey,
      model: effectiveModel,
    })

    return NextResponse.json({
      configured: true,
      protocol: saved.protocol,
      apiUrl: saved.apiUrl,
      apiKeyConfigured: !!saved.apiKey,
      model: saved.model,
    })
  } catch (error) {
    console.error('PUT /api/settings/ai error:', error)
    return NextResponse.json(
      { error: '保存 AI 配置失败', code: 'SAVE_ERROR' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const db = getDb()
    await clearAIConfig(db)
    return NextResponse.json({ configured: false })
  } catch (error) {
    console.error('DELETE /api/settings/ai error:', error)
    return NextResponse.json(
      { error: '删除 AI 配置失败', code: 'DELETE_ERROR' },
      { status: 500 }
    )
  }
}
