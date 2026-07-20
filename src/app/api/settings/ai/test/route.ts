import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getAIConfig } from '@/lib/ai/config'
import { testConnection } from '@/lib/ai/provider'

export async function POST() {
  try {
    const db = getDb()
    const config = await getAIConfig(db)

    if (!config) {
      return NextResponse.json(
        { error: 'AI 未配置', code: 'AI_NOT_CONFIGURED' },
        { status: 400 }
      )
    }

    const result = await testConnection(config)

    return NextResponse.json({
      ok: result.ok,
      error: result.error,
    })
  } catch (error) {
    console.error('POST /api/settings/ai/test error:', error)
    return NextResponse.json(
      { error: '连接测试失败', code: 'TEST_ERROR' },
      { status: 500 }
    )
  }
}
