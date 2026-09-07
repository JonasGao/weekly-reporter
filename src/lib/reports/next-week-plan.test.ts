import { describe, expect, it } from 'vitest'
import { parseNextWeekPlan } from './next-week-plan'

describe('parseNextWeekPlan', () => {
  it('matches title case-insensitively and trims heading whitespace', () => {
    expect(parseNextWeekPlan('##   下周计划  \n- first\n## details\n- ignored')).toMatchObject({
      status: 'found',
      items: ['first'],
      sectionLevel: 2,
    })
  })

  it('accepts only level two and three headings', () => {
    expect(parseNextWeekPlan('# 下周计划\n- no')).toMatchObject({ status: 'missing' })
    expect(parseNextWeekPlan('#### 下周计划\n- no')).toMatchObject({ status: 'missing' })
  })

  it('stops at the next same or higher heading while allowing nested headings', () => {
    expect(parseNextWeekPlan('## 下周计划\n- first\n### detail\n- second\n## 本周完成\n- ignored')).toMatchObject({
      status: 'found',
      items: ['first', 'second'],
    })
  })

  it('accepts all unordered list markers and warns on duplicate sections', () => {
    expect(parseNextWeekPlan('## 下周计划\n* one\n+ two\n## 下周计划\n- ignored')).toMatchObject({
      status: 'found',
      items: ['one', 'two'],
      warning: expect.stringContaining('only the first was used'),
    })
  })

  it('returns explicit empty and parse-failed states instead of guessing prose', () => {
    expect(parseNextWeekPlan('## 下周计划\n\n## 其他')).toMatchObject({ status: 'empty' })
    expect(parseNextWeekPlan('## 下周计划\n待完成事项见正文')).toMatchObject({ status: 'failed' })
  })

  it('ignores headings and list markers inside fenced code blocks', () => {
    expect(parseNextWeekPlan('```md\n## 下周计划\n- fake\n```\n## 下周计划\n- real')).toMatchObject({
      status: 'found',
      items: ['real'],
    })
  })
})
