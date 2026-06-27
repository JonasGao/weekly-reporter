import { describe, it, expect } from 'vitest';
import { renderTemplate } from './render';

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
});