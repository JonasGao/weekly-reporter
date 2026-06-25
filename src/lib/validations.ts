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

export const collectSourceSchema = z.object({
  type: z.enum(['git-remote-github', 'git-remote-gitlab', 'git-remote-gitee']),
  name: z.string().min(1, '采集源名称不能为空').max(100),
  config: z.object({
    baseUrl: z.string().optional(),
    owner: z.string().min(1, 'owner 不能为空'),
    repo: z.string().min(1, 'repo 不能为空'),
    token: z.string().min(1, 'token 不能为空'),
    authorEmails: z.array(z.string()).min(1, '至少需要一个作者邮箱'),
    branch: z.string().optional(),
  }),
  enabled: z.boolean().optional(),
})

export type CollectSourceInput = z.infer<typeof collectSourceSchema>