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

export interface RenderOptions {
  date?: Date;
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
  const sectionVariables = ['核心成果', '问题与风险', '下周计划', '日常事务'];
  const emptyListItems = '- \n- \n- ';
  
  for (const section of sectionVariables) {
    result = result.replace(new RegExp(`\\{\\{${section}\\}\\}`, 'g'), emptyListItems);
  }

  return result;
}