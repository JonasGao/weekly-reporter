import { describe, it, expect } from 'vitest';
import { renderTemplate, RenderOptions } from './render';
import { RawEvent, SectionType, TemplateConfig } from '@/lib/db/schema';

describe('renderTemplate', () => {
  describe('System Variables', () => {
    it('should replace {{本周日期范围}} with formatted date range', () => {
      const content = '本周工作总结：{{本周日期范围}}';
      const options = { date: new Date('2026-06-27') }; // Friday
      
      const result = renderTemplate(content, options);
      
      // Week should be Jun 22-28, 2026 (week starts on Monday)
      expect(result).toContain('2026.06.22');
      expect(result).toContain('2026.06.28');
      expect(result).not.toContain('{{本周日期范围}}');
    });

    it('should replace {{当前周数}} with week number', () => {
      const content = '当前是{{当前周数}}';
      const options = { date: new Date('2026-06-27') };
      
      const result = renderTemplate(content, options);
      
      expect(result).toBe('当前是第26周');
      expect(result).not.toContain('{{当前周数}}');
    });

    it('should replace {{年份}} with year', () => {
      const content = '{{年份}}年度工作计划';
      const options = { date: new Date('2026-06-27') };
      
      const result = renderTemplate(content, options);
      
      expect(result).toBe('2026年度工作计划');
      expect(result).not.toContain('{{年份}}');
    });

    it('should replace {{月份}} with month', () => {
      const content = '{{月份}}工作报告';
      const options = { date: new Date('2026-06-27') };
      
      const result = renderTemplate(content, options);
      
      expect(result).toBe('6月工作报告');
      expect(result).not.toContain('{{月份}}');
    });

    it('should replace {{上周日期范围}} with last week date range', () => {
      const content = '上周回顾：{{上周日期范围}}';
      const options = { date: new Date('2026-06-27') }; // Friday (week of Jun 22-28)
      
      const result = renderTemplate(content, options);
      
      // Last week should be Jun 15-21, 2026
      expect(result).toContain('2026.06.15');
      expect(result).toContain('2026.06.21');
      expect(result).not.toContain('{{上周日期范围}}');
    });
  });

  describe('Section Variables', () => {
    it('should replace {{核心成果}} with empty list items', () => {
      const content = '## 本周核心成果\n{{核心成果}}';
      const result = renderTemplate(content);
      
      expect(result).toBe('## 本周核心成果\n- \n- \n- ');
      expect(result).not.toContain('{{核心成果}}');
    });

    it('should replace {{问题与风险}} with empty list items', () => {
      const content = '## 问题与风险\n{{问题与风险}}';
      const result = renderTemplate(content);
      
      expect(result).toBe('## 问题与风险\n- \n- \n- ');
      expect(result).not.toContain('{{问题与风险}}');
    });

    it('should replace {{下周计划}} with empty list items', () => {
      const content = '## 下周计划\n{{下周计划}}';
      const result = renderTemplate(content);
      
      expect(result).toBe('## 下周计划\n- \n- \n- ');
      expect(result).not.toContain('{{下周计划}}');
    });

    it('should replace {{日常事务}} with empty list items', () => {
      const content = '## 日常事务\n{{日常事务}}';
      const result = renderTemplate(content);
      
      expect(result).toBe('## 日常事务\n- \n- \n- ');
      expect(result).not.toContain('{{日常事务}}');
    });
  });

  describe('Edge Cases', () => {
    it('should return unchanged content without variables', () => {
      const content = '这是一段普通文本\n没有任何变量';
      
      const result = renderTemplate(content);
      
      expect(result).toBe(content);
    });

    it('should replace only variables present in content', () => {
      const content = '{{年份}}年报告\n本周：{{本周日期范围}}';
      const options = { date: new Date('2026-06-27') };
      
      const result = renderTemplate(content, options);
      
      expect(result).toContain('2026年报告');
      expect(result).toContain('2026.06.22');
      expect(result).not.toContain('{{年份}}');
      expect(result).not.toContain('{{本周日期范围}}');
    });

    it('should not replace misspelled variables', () => {
      const content = '{{年份}}年报告\n{{年份123}}\n{{本周日期范}}';
      const options = { date: new Date('2026-06-27') };
      
      const result = renderTemplate(content, options);
      
      expect(result).toContain('2026年报告');
      expect(result).toContain('{{年份123}}');
      expect(result).toContain('{{本周日期范}}');
      expect(result).not.toContain('{{年份}}');
    });
  });

  describe('Event Binding', () => {
    const createEvent = (
      content: string,
      sectionType: SectionType,
      eventTime: Date
    ): RawEvent => ({
      id: 1,
      eventTime,
      source: 'github',
      content,
      metadata: {},
      category: null,
      sectionType,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should replace section variables with event content when events provided', () => {
      const content = '## 本周核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('完成了用户认证功能', 'achievement', new Date('2026-06-27')),
        createEvent('修复了登录页面bug', 'achievement', new Date('2026-06-26')),
      ];
      const options: RenderOptions = { events };

      const result = renderTemplate(content, options);

      expect(result).toContain('完成了用户认证功能');
      expect(result).toContain('修复了登录页面bug');
      expect(result).not.toContain('{{核心成果}}');
    });

    it('should filter events by section type', () => {
      const content = '## 核心成果\n{{核心成果}}\n## 问题与风险\n{{问题与风险}}';
      const events: RawEvent[] = [
        createEvent('成果1', 'achievement', new Date('2026-06-27')),
        createEvent('成果2', 'achievement', new Date('2026-06-26')),
        createEvent('风险1', 'risk', new Date('2026-06-27')),
        createEvent('计划1', 'plan', new Date('2026-06-27')),
        createEvent('日常1', 'routine', new Date('2026-06-27')),
      ];
      const options: RenderOptions = { events };

      const result = renderTemplate(content, options);

      // Check that sections are correctly populated
      const sections = result.split('\n## ');
      const achievementSection = sections[0].replace('## ', ''); // First section has ## prefix
      const riskSection = sections.find(s => s.startsWith('问题与风险'));

      // 核心成果 should only contain achievement events
      expect(achievementSection).toContain('核心成果');
      expect(achievementSection).toContain('- 成果1');
      expect(achievementSection).toContain('- 成果2');
      expect(achievementSection).not.toContain('- 风险1');

      // 问题与风险 should only contain risk events
      expect(riskSection).toBeDefined();
      expect(riskSection).toContain('问题与风险');
      expect(riskSection).toContain('- 风险1');
      expect(riskSection).not.toContain('- 成果1');
    });

    it('should filter trivial events when filterTrivial is true', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('fix typo in README.md', 'achievement', new Date('2026-06-27')),
        createEvent('完成了重要的API重构', 'achievement', new Date('2026-06-26')),
        createEvent('update comment in utils.ts', 'achievement', new Date('2026-06-25')),
      ];
      const sectionConfig: TemplateConfig['sectionConfig'] = {
        achievement: { filterTrivial: true },
      };
      const options: RenderOptions = { events, sectionConfig };

      const result = renderTemplate(content, options);

      expect(result).toContain('- 完成了重要的API重构');
      expect(result).not.toContain('fix typo');
      expect(result).not.toContain('update comment');
    });

    it('should sort events by time descending when autoSort is true', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('早期事件', 'achievement', new Date('2026-06-20')),
        createEvent('中期事件', 'achievement', new Date('2026-06-25')),
        createEvent('最新事件', 'achievement', new Date('2026-06-27')),
      ];
      const options: RenderOptions = { events };

      const result = renderTemplate(content, options);

      // Should appear in reverse chronological order
      const lines = result.split('\n');
      const eventLines = lines.filter(l => l.startsWith('- '));
      expect(eventLines[0]).toContain('最新事件');
      expect(eventLines[1]).toContain('中期事件');
      expect(eventLines[2]).toContain('早期事件');
    });

    it('should respect maxItems configuration', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('事件1', 'achievement', new Date('2026-06-27')),
        createEvent('事件2', 'achievement', new Date('2026-06-26')),
        createEvent('事件3', 'achievement', new Date('2026-06-25')),
        createEvent('事件4', 'achievement', new Date('2026-06-24')),
        createEvent('事件5', 'achievement', new Date('2026-06-23')),
      ];
      const sectionConfig: TemplateConfig['sectionConfig'] = {
        achievement: { maxItems: 3 },
      };
      const options: RenderOptions = { events, sectionConfig };

      const result = renderTemplate(content, options);

      // Should only include the first 3 events (sorted by time)
      expect(result).toContain('- 事件1');
      expect(result).toContain('- 事件2');
      expect(result).toContain('- 事件3');
      expect(result).not.toContain('- 事件4');
      expect(result).not.toContain('- 事件5');
    });

    it('should maintain backward compatibility with no events', () => {
      const content = '## 核心成果\n{{核心成果}}';
      
      const result = renderTemplate(content);
      
      // Should still return empty list items
      expect(result).toBe('## 核心成果\n- \n- \n- ');
      expect(result).not.toContain('{{核心成果}}');
    });

    it('should return empty list items when no matching events', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('风险事件', 'risk', new Date('2026-06-27')),
      ];
      const options: RenderOptions = { events };

      const result = renderTemplate(content, options);

      // No achievement events, should return empty list
      expect(result).toBe('## 核心成果\n- \n- \n- ');
    });

    it('should apply all filters together', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('重要成果1', 'achievement', new Date('2026-06-27')),
        createEvent('fix typo', 'achievement', new Date('2026-06-26')),
        createEvent('重要成果2', 'achievement', new Date('2026-06-25')),
        createEvent('重要成果3', 'achievement', new Date('2026-06-24')),
        createEvent('chore: update deps', 'achievement', new Date('2026-06-23')),
        createEvent('风险事件', 'risk', new Date('2026-06-27')),
      ];
      const sectionConfig: TemplateConfig['sectionConfig'] = {
        achievement: {
          filterTrivial: true,
          maxItems: 2,
          autoSort: true,
        },
      };
      const options: RenderOptions = { events, sectionConfig };

      const result = renderTemplate(content, options);

      // Should filter trivial, sort by time, limit to 2 items
      const lines = result.split('\n').filter(l => l.startsWith('- '));
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('重要成果1');
      expect(lines[1]).toContain('重要成果2');
    });

    it('should handle short content as trivial', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('短内容', 'achievement', new Date('2026-06-27')),
        createEvent('这是一个足够长的重要内容描述，超过50个字符', 'achievement', new Date('2026-06-26')),
      ];
      const sectionConfig: TemplateConfig['sectionConfig'] = {
        achievement: { filterTrivial: true },
      };
      const options: RenderOptions = { events, sectionConfig };

      const result = renderTemplate(content, options);

      expect(result).toContain('这是一个足够长的重要内容描述');
      expect(result).not.toContain('短内容');
    });

    it('should handle events for all section types', () => {
      const content = `
## 核心成果
{{核心成果}}

## 问题与风险
{{问题与风险}}

## 下周计划
{{下周计划}}

## 日常事务
{{日常事务}}
`.trim();
      const events: RawEvent[] = [
        createEvent('成果1', 'achievement', new Date('2026-06-27')),
        createEvent('风险1', 'risk', new Date('2026-06-27')),
        createEvent('计划1', 'plan', new Date('2026-06-27')),
        createEvent('日常1', 'routine', new Date('2026-06-27')),
      ];
      const options: RenderOptions = { events };

      const result = renderTemplate(content, options);

      expect(result).toContain('- 成果1');
      expect(result).toContain('- 风险1');
      expect(result).toContain('- 计划1');
      expect(result).toContain('- 日常1');
    });
  });

  describe('enabledSections', () => {
    const createEvent = (
      content: string,
      sectionType: SectionType,
      eventTime: Date
    ): RawEvent => ({
      id: 1,
      eventTime,
      source: 'test',
      content,
      metadata: {},
      category: null,
      sectionType,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should remove disabled sections', () => {
      const content = '## 本周完成\n{{本周完成}}\n## 进行中\n{{进行中}}\n## 下周计划\n{{下周计划}}';
      const sectionTypeMap = {
        '本周完成': 'achievement' as SectionType,
        '进行中': 'plan' as SectionType,
        '下周计划': 'plan' as SectionType,
      };
      const result = renderTemplate(content, {
        enabledSections: ['本周完成', '下周计划'],
        sectionTypeMap,
      });

      expect(result).toContain('## 本周完成');
      expect(result).toContain('## 下周计划');
      expect(result).not.toContain('## 进行中');
      expect(result).not.toContain('{{进行中}}');
    });

    it('should keep all sections when enabledSections includes all', () => {
      const content = '## 本周完成\n{{本周完成}}\n## 下周计划\n{{下周计划}}';
      const sectionTypeMap = {
        '本周完成': 'achievement' as SectionType,
        '下周计划': 'plan' as SectionType,
      };
      const result = renderTemplate(content, {
        enabledSections: ['本周完成', '下周计划'],
        sectionTypeMap,
      });

      expect(result).toContain('## 本周完成');
      expect(result).toContain('## 下周计划');
    });

    it('should apply sectionConfig by SectionType for enabled sections', () => {
      const content = '## 核心成果\n{{核心成果}}';
      const events: RawEvent[] = [
        createEvent('事件1', 'achievement', new Date('2026-07-01')),
        createEvent('事件2', 'achievement', new Date('2026-07-02')),
        createEvent('事件3', 'achievement', new Date('2026-07-03')),
        createEvent('事件4', 'achievement', new Date('2026-07-04')),
      ];

      const result = renderTemplate(content, {
        events,
        sectionConfig: {
          achievement: { maxItems: 3, autoSort: true, filterTrivial: false }
        }
      });

      const lines = result.split('\n').filter(l => l.startsWith('- '));
      expect(lines.length).toBe(3);
    });

    it('should fall back to default SECTION_CONFIG when no sectionTypeMap provided', () => {
      const content = '## 核心成果\n{{核心成果}}\n## 下周计划\n{{下周计划}}';
      const result = renderTemplate(content);

      expect(result).toContain('## 核心成果');
      expect(result).toContain('## 下周计划');
      expect(result).not.toContain('{{核心成果}}');
      expect(result).not.toContain('{{下周计划}}');
    });
  });
});