import { describe, it, expect } from 'vitest'
import { extractViewConfig, resolveSectionType } from './view-config'
import { TemplateConfig } from '@/lib/db/schema'

describe('extractViewConfig', () => {
  it('should return leadership config when viewConfigs is present', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成', '下周计划'],
          sectionConfig: {
            '本周完成': { maxItems: 3, autoSort: true, filterTrivial: true },
          },
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '进行中', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }

    const config = extractViewConfig(templateConfig, 'leadership')

    expect(config.enabledSections).toEqual(['本周完成', '下周计划'])
    expect(config.aiStyle).toBe('formal')
  })

  it('should return personal config when viewConfigs is present', () => {
    const templateConfig: TemplateConfig = {
      viewConfigs: {
        leadership: {
          enabledSections: ['本周完成'],
          sectionConfig: {},
          aiStyle: 'formal'
        },
        personal: {
          enabledSections: ['本周完成', '进行中', '遇到的问题', '下周计划'],
          sectionConfig: {},
          aiStyle: 'detailed'
        }
      }
    }

    const config = extractViewConfig(templateConfig, 'personal')

    expect(config.enabledSections).toContain('进行中')
    expect(config.enabledSections).toContain('遇到的问题')
    expect(config.aiStyle).toBe('detailed')
  })

  it('should fallback to all sections from sectionTypeMap if no viewConfigs', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '下周计划': 'plan',
      }
    }

    const config = extractViewConfig(templateConfig, 'personal')

    expect(config.enabledSections).toEqual(['本周完成', '下周计划'])
    expect(config.aiStyle).toBe('detailed')
  })

  it('should return empty enabledSections for default config without sectionTypeMap', () => {
    const config = extractViewConfig({}, 'leadership')

    expect(config.enabledSections).toEqual([])
    expect(config.aiStyle).toBe('formal')
  })
})

describe('resolveSectionType', () => {
  it('should resolve section type from sectionTypeMap', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: {
        '本周完成': 'achievement',
        '遇到的问题': 'risk',
      }
    }

    expect(resolveSectionType(templateConfig, '本周完成')).toBe('achievement')
    expect(resolveSectionType(templateConfig, '遇到的问题')).toBe('risk')
  })

  it('should return undefined for unknown section title', () => {
    const templateConfig: TemplateConfig = {
      sectionTypeMap: { '本周完成': 'achievement' }
    }

    expect(resolveSectionType(templateConfig, '不存在的section')).toBeUndefined()
  })

  it('should return undefined when no sectionTypeMap', () => {
    expect(resolveSectionType({}, '本周完成')).toBeUndefined()
  })
})
