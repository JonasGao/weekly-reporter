import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  getWeek,
  getYear,
  getMonth,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { RawEvent, SectionType, TemplateConfig, SectionRenderConfig } from '@/lib/db/schema';

export interface RenderOptions {
  date?: Date;
  events?: RawEvent[];
  sectionConfig?: TemplateConfig['sectionConfig'];
  enabledSections?: string[];
  sectionTypeMap?: Record<string, SectionType>;
}

const EMPTY_LIST_ITEMS = '- \n- \n- ';

const TRIVIAL_KEYWORDS = [
  'fix typo',
  'update comment',
  'refactor minor',
  'chore',
  'docs',
  'formatting',
  'whitespace',
];

function isTrivialEvent(content: string): boolean {
  // Threshold adjusted for Chinese content: 5 chars minimum
  // (Chinese chars carry more meaning per character than English)
  if (content.length < 5) return true;
  const lowerContent = content.toLowerCase();
  return TRIVIAL_KEYWORDS.some((kw) => lowerContent.includes(kw));
}

function filterAndFormatEvents(
  events: RawEvent[],
  type: SectionType,
  config?: SectionRenderConfig
): string {
  let filtered = events.filter((e) => e.sectionType === type);

  if (config?.filterTrivial) {
    filtered = filtered.filter((e) => !isTrivialEvent(e.content));
  }

  if (config?.autoSort !== false) {
    filtered.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
  }

  if (config?.maxItems) {
    filtered = filtered.slice(0, config.maxItems);
  }

  if (filtered.length === 0) return EMPTY_LIST_ITEMS;
  return filtered.map((e) => `- ${e.content}`).join('\n');
}

function removeSection(content: string, sectionTitle: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (line.trim() === `## ${sectionTitle}`) {
      skipping = true;
      continue;
    }
    if (skipping && line.startsWith('## ')) {
      skipping = false;
    }
    if (!skipping) {
      result.push(line);
    }
  }

  return result.join('\n');
}

export function renderTemplate(content: string, options?: RenderOptions): string {
  const baseDate = options?.date ?? new Date();

  // Replace system variables
  let result = content;

  // {{本周日期范围}}
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const weekRange = `${format(weekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(weekEnd, 'yyyy.MM.dd', { locale: zhCN })}`;
  result = result.replace(/\{\{本周日期范围\}\}/g, weekRange);

  // {{上周日期范围}}
  const lastWeekStart = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 });
  const lastWeekRange = `${format(lastWeekStart, 'yyyy.MM.dd', { locale: zhCN })} - ${format(lastWeekEnd, 'yyyy.MM.dd', { locale: zhCN })}`;
  result = result.replace(/\{\{上周日期范围\}\}/g, lastWeekRange);

  // {{当前周数}}
  const weekNumber = getWeek(baseDate, { weekStartsOn: 1 });
  result = result.replace(/\{\{当前周数\}\}/g, `第${weekNumber}周`);

  // {{年份}}
  const year = getYear(baseDate);
  result = result.replace(/\{\{年份\}\}/g, year.toString());

  // {{月份}}
  const month = getMonth(baseDate) + 1; // getMonth returns 0-11
  result = result.replace(/\{\{月份\}\}/g, `${month}月`);

  // Replace section variables
  const DEFAULT_SECTION_CONFIG: Record<string, SectionType> = {
    核心成果: 'achievement',
    问题与风险: 'risk',
    下周计划: 'plan',
    日常事务: 'routine',
  };

  const sectionMap = options?.sectionTypeMap || DEFAULT_SECTION_CONFIG;

  for (const [sectionTitle, sectionType] of Object.entries(sectionMap)) {
    if (options?.enabledSections && !options.enabledSections.includes(sectionTitle)) {
      result = removeSection(result, sectionTitle);
      const placeholderRegex = new RegExp(`\\{\\{${sectionTitle}\\}\\}`, 'g');
      result = result.replace(placeholderRegex, '');
      continue;
    }

    let replacement: string;

    if (options?.events && options.events.length > 0) {
      replacement = filterAndFormatEvents(
        options.events,
        sectionType,
        options.sectionConfig?.[sectionType]
      );
    } else {
      replacement = EMPTY_LIST_ITEMS;
    }

    result = result.replace(
      new RegExp(`\\{\\{${sectionTitle}\\}\\}`, 'g'),
      replacement
    );
  }

  return result;
}