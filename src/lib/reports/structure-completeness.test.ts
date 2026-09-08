import { describe, expect, it } from 'vitest'
import {
  STRUCTURE_COMPLETENESS_RULE_VERSION,
  createStructureCompletenessRule,
  normalizeStructureCompletenessRule,
} from './structure-completeness'

describe('structure completeness rule', () => {
  it('requires the standard next-week plan section unless the adopted template forbids it', () => {
    expect(createStructureCompletenessRule('允许扩展周报内容')).toEqual({
      version: STRUCTURE_COMPLETENESS_RULE_VERSION,
      nextWeekPlan: 'required',
    })
    expect(createStructureCompletenessRule('本模板明确禁止下周计划章节。')).toEqual({
      version: STRUCTURE_COMPLETENESS_RULE_VERSION,
      nextWeekPlan: 'forbidden',
    })
  })

  it('uses an already saved rule instead of reinterpreting a changed template', () => {
    expect(normalizeStructureCompletenessRule(
      { version: STRUCTURE_COMPLETENESS_RULE_VERSION, nextWeekPlan: 'forbidden' },
      '允许扩展并要求下周计划',
    )).toEqual({ version: STRUCTURE_COMPLETENESS_RULE_VERSION, nextWeekPlan: 'forbidden' })
  })

  it('keeps a historical rule version instead of replacing it with the current one', () => {
    expect(normalizeStructureCompletenessRule(
      { version: 'next-week-plan-structure/v0', nextWeekPlan: 'required' },
      '明确禁止下周计划章节',
    )).toEqual({ version: 'next-week-plan-structure/v0', nextWeekPlan: 'required' })
  })

  it('derives a compatibility rule from the final template snapshot when old variants have none', () => {
    expect(normalizeStructureCompletenessRule(null, '明确禁止下周计划章节')).toEqual({
      version: STRUCTURE_COMPLETENESS_RULE_VERSION,
      nextWeekPlan: 'forbidden',
    })
  })
})
