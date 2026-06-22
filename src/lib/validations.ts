import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const reportSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().min(1, '内容不能为空'),
  weekStart: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
  weekEnd: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
}).refine(
  (data) => new Date(data.weekStart) <= new Date(data.weekEnd),
  {
    message: '开始日期不能晚于结束日期',
    path: ['weekEnd'],
  }
)

export type ReportInput = z.infer<typeof reportSchema>

export const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  content: z.string().min(1, '模板内容不能为空'),
  workTypes: z.string().optional(),
})

export type TemplateInput = z.infer<typeof templateSchema>