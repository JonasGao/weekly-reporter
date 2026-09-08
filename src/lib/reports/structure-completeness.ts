export const STRUCTURE_COMPLETENESS_RULE_VERSION = 'next-week-plan-structure/v1' as const

export interface StructureCompletenessRule {
  version: string
  nextWeekPlan: 'required' | 'forbidden'
}

export function nextWeekPlanPolicy(templateContent: string): StructureCompletenessRule['nextWeekPlan'] {
  const normalized = templateContent.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase()
  const forbidden = /(?:禁止|不要|不包含|不需要|不应|不写|无需|省略|不适用|omit|without|exclude|no)\s*(?:编写|输出|包含|添加|include|write)?\s*(?:“|「|the\s+)?(?:下周计划|下周重点|next\s*week\s*plan)/i.test(normalized)
    || /(?:下周计划|next\s*week\s*plan)[^。.!\n]{0,30}(?:禁止|不要|不包含|不需要|不应|不写|无需|省略|不适用|omit|without|exclude|no)/i.test(normalized)
  return forbidden ? 'forbidden' : 'required'
}

export function createStructureCompletenessRule(templateContent: string): StructureCompletenessRule {
  return { version: STRUCTURE_COMPLETENESS_RULE_VERSION, nextWeekPlan: nextWeekPlanPolicy(templateContent) }
}

export function normalizeStructureCompletenessRule(
  savedRule: unknown,
  templateContent: string | null | undefined,
): StructureCompletenessRule {
  if (savedRule && typeof savedRule === 'object') {
    const candidate = savedRule as Partial<StructureCompletenessRule>
    if (typeof candidate.version === 'string' && candidate.version.trim() && (candidate.nextWeekPlan === 'required' || candidate.nextWeekPlan === 'forbidden')) {
      return { version: candidate.version, nextWeekPlan: candidate.nextWeekPlan }
    }
  }
  return createStructureCompletenessRule(templateContent ?? '')
}
