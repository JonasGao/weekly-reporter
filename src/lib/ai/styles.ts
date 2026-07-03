export interface AIStyleConfig {
  label: string
  systemPrompt: string
  temperature: number
  scoreWeights: {
    structure: number
    content: number
    value: number
  }
  detailLevel?: 'low' | 'medium' | 'high'
  resultOriented?: 'low' | 'medium' | 'high'
}

export const aiStyles: Record<string, AIStyleConfig> = {
  formal: {
    label: '正式汇报',
    systemPrompt: '你是专业的职场周报润色助手，表达正式严谨，突出成果价值,语言精炼专业。',
    temperature: 0.3,
    scoreWeights: {
      structure: 0.25,
      content: 0.3,
      value: 0.45,
    }
  },
  technical: {
    label: '技术研发',
    systemPrompt: '你是技术研发周报助手，表述专业准确，保留技术细节，突出问题解决与技术沉淀。',
    temperature: 0.4,
    scoreWeights: {
      structure: 0.2,
      content: 0.5,
      value: 0.3,
    }
  },
  concise: {
    label: '极简干练',
    systemPrompt: '你是精简周报助手，用短句表达，去掉冗余修饰，只保留核心信息。',
    temperature: 0.2,
    scoreWeights: {
      structure: 0.4,
      content: 0.3,
      value: 0.3,
    }
  },
  detailed: {
    label: '深度复盘',
    systemPrompt: '你是个人工作复盘助手，侧重问题分析、经验沉淀、成长总结，表达平实详细。',
    temperature: 0.5,
    scoreWeights: {
      structure: 0.2,
      content: 0.55,
      value: 0.25,
    }
  },
}

export function getAIStyle(styleKey?: string): AIStyleConfig {
  return aiStyles[styleKey || 'formal'] || aiStyles.formal
}

export function getStyleLabel(styleKey: string): string {
  return aiStyles[styleKey]?.label || '正式汇报'
}