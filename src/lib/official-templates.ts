export interface OfficialTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  content: string
}

export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-general',
    name: '通用正式周报模板',
    description: '适合大多数工作场景的3+1结构周报',
    tags: ['通用', '正式'],
    content: `## 本周完成
- [工作项1：描述 + 成果/价值]
- [工作项2：描述 + 成果/价值]

## 进行中
- [项目/任务名称：进度描述 + 预计完成时间]

## 遇到的问题
- [问题描述 + 原因分析 + 已采取措施/需要支持]

## 下周计划
- [计划事项 + 优先级]
`
  },
  {
    id: 'official-tech-dev',
    name: '技术研发专属周报模板',
    description: '专为研发岗位设计，涵盖开发、修复、运维等维度',
    tags: ['技术研发', '开发'],
    content: `## 开发进度
- [开发项1：功能描述 + 进度% + 预计完成时间]
- [开发项2：功能描述 + 进度% + 预计完成时间]

## Bug修复
- [Bug ID：问题描述 + 修复方案 + 影响范围]

## 运维工作
- [运维事项：系统监控/部署/优化 + 结果]

## 技术沉淀
- [学习内容/文档输出/技术分享 + 产出]

## 下周计划
- [计划事项 + 优先级 + 预计工作量]
`
  },
  {
    id: 'official-minimal',
    name: '极简快速周报模板',
    description: '适合周会同步的轻量级模板',
    tags: ['极简', '快速'],
    content: `## 本周完成
- [关键成果1]
- [关键成果2]

## 下周重点
- [重点事项]
`
  },
  {
    id: 'official-personal-review',
    name: '个人复盘周报模板',
    description: '侧重沉淀、踩坑记录和时间复盘',
    tags: ['个人', '复盘'],
    content: `## 本周成果
- [成果1：描述 + 个人收获]
- [成果2：描述 + 个人收获]

## 踩坑记录
- [踩坑点：问题描述 + 解决方案 + 防范措施]

## 技术沉淀
- [学习内容：知识点 + 实践应用]

## 时间复盘
- [本周时间分配]
- [效率提升点/改进方向]

## 下周计划
- [个人成长目标 + 工作安排]
`
  }
]