export interface OfficialTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  content: string
  aiStyle?: string
}

export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-general',
    name: '通用正式周报模板',
    description: '适合大多数工作场景的正式汇报结构',
    tags: ['通用', '正式'],
    aiStyle: 'formal',
    content: `请输出一份正式、简洁的周报，包含以下结构：

## 本周完成
按工作主题归纳已完成事项，先写结果，再补充关键细节。

## 进行中与风险
说明未完成事项、当前进展和需要关注的问题。

## 下周计划
列出明确、可执行的下一步计划。`,
  },
  {
    id: 'official-tech-dev',
    name: '技术研发专属周报模板',
    description: '突出技术决策、研发成果、风险和技术沉淀',
    tags: ['技术研发', '开发'],
    aiStyle: 'technical',
    content: `请输出一份面向技术负责人和架构师的研发周报，包含以下结构：

## 开发进度
按技术主题归纳开发成果和关键决策。

## Bug 修复与风险
说明已解决问题、潜在风险和影响范围。

## 运维与技术沉淀
总结运维工作、工程改进和可复用经验。

## 下周计划
列出下一步研发计划和依赖。`,
  },
  {
    id: 'official-minimal',
    name: '极简快速周报模板',
    description: '适合周会同步的轻量级周报',
    tags: ['极简', '快速'],
    aiStyle: 'concise',
    content: `请输出一份极简周报，只保留最重要的信息：

## 本周重点
用一句话概括每项工作及其结果。

## 下周重点
列出最重要、最具体的下一步行动。`,
  },
  {
    id: 'official-personal-review',
    name: '个人复盘周报模板',
    description: '侧重沉淀、踩坑记录和时间复盘',
    tags: ['个人', '复盘'],
    aiStyle: 'detailed',
    content: `请输出一份个人工作复盘周报，包含以下结构：

## 本周成果
总结完成的工作及其结果。

## 踩坑记录
记录遇到的困难、原因和解决方式。

## 技术与经验沉淀
提炼可复用的方法、决策和经验。

## 下周计划
列出下一步行动和改进方向。`,
  },
]
