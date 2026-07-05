import { TemplateConfig, ViewConfig, SectionType } from '@/lib/db/schema'

const DEFAULT_LEADERSHIP_CONFIG: ViewConfig = {
  enabledSections: [],
  sectionConfig: {},
  aiStyle: 'formal'
}

const DEFAULT_PERSONAL_CONFIG: ViewConfig = {
  enabledSections: [],
  sectionConfig: {},
  aiStyle: 'detailed'
}

export function extractViewConfig(
  templateConfig: TemplateConfig,
  viewType: 'leadership' | 'personal'
): ViewConfig {
  if (templateConfig.viewConfigs?.[viewType]) {
    return templateConfig.viewConfigs[viewType]
  }

  if (templateConfig.sectionTypeMap) {
    const allSections = Object.keys(templateConfig.sectionTypeMap)
    return {
      enabledSections: allSections,
      sectionConfig: {},
      aiStyle: viewType === 'leadership' ? 'formal' : 'detailed'
    }
  }

  return viewType === 'leadership' ? DEFAULT_LEADERSHIP_CONFIG : DEFAULT_PERSONAL_CONFIG
}

export function resolveSectionType(
  templateConfig: TemplateConfig,
  sectionTitle: string
): SectionType | undefined {
  return templateConfig.sectionTypeMap?.[sectionTitle]
}
