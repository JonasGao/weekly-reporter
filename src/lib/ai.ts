const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions'
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

export interface CheckRequest {
  content: string
  section?: string
}

export interface CheckResponse {
  suggestions: string[]
  score?: number
}

export interface ScoreRequest {
  content: string
}

export interface ScoreResponse {
  score: {
    structure: number
    content: number
    value: number
    overall: number
  }
  suggestions: string[]
  rewriteExamples?: {
    original: string
    improved: string
  }[]
}

export async function checkContent(request: CheckRequest): Promise<CheckResponse> {
  if (!AI_API_KEY) {
    return { suggestions: ['AI API Key 未配置'] }
  }

  const prompt = `你是一个周报写作助手。用户正在写周报，请分析以下内容并给出改进建议。

内容：
${request.content}

${request.section ? `当前区块：${request.section}` : ''}

请从以下方面分析：
1. 是否有具体数据和细节支撑
2. 是否突出了成果和价值
3. 表达是否清晰简洁
4. 是否有更好的表达方式

请给出具体、简洁的建议（每条不超过20字），以JSON数组格式返回。
如果内容很好，返回空数组 []。

示例输出格式：
["建议添加具体数据", "建议使用成果动词"]

直接返回JSON数组，不要其他内容。`

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      return { suggestions: [] }
    }

    const data = await response.json()
    const suggestionsText = data.choices?.[0]?.message?.content?.trim() || ''
    
    try {
      const suggestions = JSON.parse(suggestionsText)
      return { suggestions }
    } catch {
      return { suggestions: [] }
    }
  } catch (error) {
    return { suggestions: [] }
  }
}

export async function scoreReport(request: ScoreRequest): Promise<ScoreResponse> {
  if (!AI_API_KEY) {
    return {
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['AI API Key 未配置'],
    }
  }

  const prompt = `你是一个周报评分专家。请对以下周报进行评分和建议。

周报内容：
${request.content}

请从以下维度评分（0-100）：
1. structure（结构完整度）：各区块是否填写完整
2. content（内容充实度）：是否有具体细节和数据
3. value（价值突出度）：是否强调成果和贡献

请给出：
1. 各维度评分
2. 具体改进建议（每条不超过30字）
3. （可选）改写示例

以以下JSON格式返回：
{
  "score": {
    "structure": <数字>,
    "content": <数字>,
    "value": <数字>,
    "overall": <数字>
  },
  "suggestions": ["<建议1>", "<建议2>"],
  "rewriteExamples": [
    {
      "original": "<原文>",
      "improved": "<改写>"
    }
  ]
}

直接返回JSON，不要其他内容。`

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      return {
        score: { structure: 0, content: 0, value: 0, overall: 0 },
        suggestions: ['AI 服务暂时不可用'],
      }
    }

    const data = await response.json()
    const resultText = data.choices?.[0]?.message?.content?.trim() || ''
    
    try {
      const result = JSON.parse(resultText)
      return {
        score: result.score || { structure: 0, content: 0, value: 0, overall: 0 },
        suggestions: result.suggestions || [],
        rewriteExamples: result.rewriteExamples,
      }
    } catch {
      return {
        score: { structure: 0, content: 0, value: 0, overall: 0 },
        suggestions: ['评分解析失败'],
      }
    }
  } catch (error) {
    return {
      score: { structure: 0, content: 0, value: 0, overall: 0 },
      suggestions: ['AI 服务暂时不可用'],
    }
  }
}