import { TemplateConfig } from '@/lib/db/schema'

export interface OfficialTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  content: string
  config?: TemplateConfig
}

export const OFFICIAL_TEMPLATES: OfficialTemplate[] = [
  {
    id: 'official-general',
    name: '通用正式周报模板',
    description: '适合大多数工作场景的3+1结构周报',
    tags: ['通用', '正式'],
    content: `## 本周完成
{{本周完成}}

## 进行中
{{进行中}}

## 遇到的问题
{{遇到的问题}}

## 下周计划
{{下周计划}}
`,
    config: {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '进行中': 'plan',
        '遇到的问题': 'risk',
        '下周计划': 'plan',
      },
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成', '下周计划'],
          sectionConfig: {
            '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
            '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '进行中', '遇到的问题', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
  },
  {
    id: 'official-tech-dev',
    name: '技术研发专属周报模板',
    description: '专为研发岗位设计，涵盖开发、修复、运维等维度',
    tags: ['技术研发', '开发'],
    content: `## 开发进度
{{开发进度}}

## Bug修复
{{Bug修复}}

## 运维工作
{{运维工作}}

## 技术沉淀
{{技术沉淀}}

## 下周计划
{{下周计划}}
`,
    config: {
      sectionTypeMap: {
        '开发进度': 'achievement',
        'Bug修复': 'risk',
        '运维工作': 'routine',
        '技术沉淀': 'achievement',
        '下周计划': 'plan',
      },
      viewConfigs: {
        leadership: {
          enabledSections: ['开发进度', 'Bug修复', '下周计划'],
          sectionConfig: {
            '开发进度': { maxItems: 3, autoSort: true, filterTrivial: true },
            'Bug修复': { maxItems: 3, autoSort: true, filterTrivial: true },
            '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['开发进度', 'Bug修复', '运维工作', '技术沉淀', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
  },
  {
    id: 'official-minimal',
    name: '极简快速周报模板',
    description: '适合周会同步的轻量级模板',
    tags: ['极简', '快速'],
    content: `## 本周完成
{{本周完成}}

## 下周重点
{{下周重点}}
`,
    config: {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '下周重点': 'plan',
      },
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成', '下周重点'],
          sectionConfig: {
            '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
            '下周重点': { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '下周重点'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
  },
  {
    id: 'official-personal-review',
    name: '个人复盘周报模板',
    description: '侧重沉淀、踩坑记录和时间复盘',
    tags: ['个人', '复盘'],
    content: `## 本周成果
{{本周成果}}

## 踩坑记录
{{踩坑记录}}

## 技术沉淀
{{技术沉淀}}

## 时间复盘
{{时间复盘}}

## 下周计划
{{下周计划}}
`,
    config: {
      sectionTypeMap: {
        '本周成果': 'achievement',
        '踩坑记录': 'risk',
        '技术沉淀': 'achievement',
        '时间复盘': 'routine',
        '下周计划': 'plan',
      },
      viewConfigs: {
        leadership: {
          enabledSections: ['本周成果', '下周计划'],
          sectionConfig: {
            '本周成果': { maxItems: 3, autoSort: true, filterTrivial: true },
            '下周计划': { maxItems: 3, autoSort: true, filterTrivial: false },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周成果', '踩坑记录', '技术沉淀', '时间复盘', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }
  }
]