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

/**
 * 判断事件是否为 git 来源
 */
function isGitEvent(event: RawEvent): boolean {
  const gitSources = ['git-local', 'github', 'gitlab'];
  return gitSources.includes(event.source);
}

/**
 * 按仓库分组渲染事件
 * git 事件按仓库分组为嵌套列表，非 git 事件为普通列表项
 * 所有顶层项按时间排序（仓库组取最近 commit 时间）
 */
function filterAndFormatEvents(
  events: RawEvent[],
  type: SectionType,
  config?: SectionRenderConfig
): string {
  let filtered = events.filter((e) => e.sectionType === type);

  if (config?.filterTrivial) {
    filtered = filtered.filter((e) => !isTrivialEvent(e.content));
  }

  if (filtered.length === 0) return EMPTY_LIST_ITEMS;

  // 分离 git 事件（有 repo 信息）和非 git 事件（无 repo 信息或非 git 源）
  const gitEvents = filtered.filter((e) => isGitEvent(e) && e.metadata?.repo);
  const nonGitEvents = filtered.filter((e) => !isGitEvent(e) || !e.metadata?.repo);

  // 按仓库分组 git 事件
  const repoGroups = new Map<string, RawEvent[]>();
  for (const event of gitEvents) {
    const repo = event.metadata?.repo || 'unknown';
    if (!repoGroups.has(repo)) {
      repoGroups.set(repo, []);
    }
    repoGroups.get(repo)!.push(event);
  }

  // 对每个仓库组内的 commit 按时间倒序排序
  for (const [, groupEvents] of repoGroups) {
    groupEvents.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
  }

  // 构建顶层项列表（仓库组 + 非 git 事件）
  interface TopLevelItem {
    type: 'repo' | 'event';
    time: number;
    repo?: string;
    events?: RawEvent[];
    event?: RawEvent;
  }

  const topLevelItems: TopLevelItem[] = [];

  // 添加仓库组（取最近 commit 时间）
  for (const [repo, groupEvents] of repoGroups) {
    const mostRecentTime = Math.max(...groupEvents.map((e) => e.eventTime.getTime()));
    topLevelItems.push({
      type: 'repo',
      time: mostRecentTime,
      repo,
      events: groupEvents,
    });
  }

  // 添加非 git 事件
  for (const event of nonGitEvents) {
    topLevelItems.push({
      type: 'event',
      time: event.eventTime.getTime(),
      event,
    });
  }

  // 按时间倒序排序所有顶层项
  topLevelItems.sort((a, b) => b.time - a.time);

  // 应用 maxItems 限制
  if (config?.maxItems) {
    topLevelItems.splice(config.maxItems);
  }

  // 渲染为 markdown
  const lines: string[] = [];
  for (const item of topLevelItems) {
    if (item.type === 'repo' && item.repo && item.events) {
      // 仓库组：嵌套列表
      lines.push(`- **${item.repo}**`);
      for (const event of item.events) {
        lines.push(`  - ${event.content}`);
      }
    } else if (item.type === 'event' && item.event) {
      // 非 git 事件：普通列表项
      lines.push(`- ${item.event.content}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : EMPTY_LIST_ITEMS;
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