import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const reportSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最多200个字符'),
  content: z.string().optional(),
  weekStart: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
  weekEnd: z.string().regex(dateRegex, '日期格式必须为 YYYY-MM-DD'),
  templateId: z.string().optional(),
  baseDate: z.string().optional(),
}).refine(
  (data) => new Date(data.weekStart) <= new Date(data.weekEnd),
  {
    message: '开始日期不能晚于结束日期',
    path: ['weekEnd'],
  }
).refine(
  (data) => {
    // Either content or templateId must be provided
    return (data.content && data.content.length > 0) || data.templateId
  },
  {
    message: '必须提供内容或模板ID',
    path: ['content'],
  }
)

export type ReportInput = z.infer<typeof reportSchema>

export const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  content: z.string().min(1, '模板内容不能为空'),
  description: z.string().max(200).optional(),
  tags: z.string().optional(),
})

export const cloneTemplateSchema = z.object({
  sourceId: z.string().min(1, '源模板ID不能为空'),
  name: z.string().min(1, '模板名称不能为空').max(100).optional(),
  content: z.string().optional(),
})

export type TemplateInput = z.infer<typeof templateSchema>
export type CloneTemplateInput = z.infer<typeof cloneTemplateSchema>

export const collectSourceSchema = z.object({
  type: z.enum(['git-remote-github', 'git-remote-gitlab', 'git-remote-gitee', 'git-local']),
  name: z.string().min(1, '采集源名称不能为空').max(100),
  config: z.object({
    baseUrl: z.string().optional(),
    owner: z.string().min(1, '路径或 owner 不能为空'),
    repo: z.string().optional(),
    token: z.string().optional(),
    authorEmails: z.array(z.string()).min(1, '至少需要一个作者邮箱'),
    branches: z.array(z.union([
      z.string(),
      z.object({ name: z.string(), lastCommitTime: z.string().nullable().optional() })
    ])).optional(),
  }),
  enabled: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.type === 'git-local') {
      return true
    }
    return data.config.repo && data.config.repo.length > 0
  },
  {
    message: '远程仓库需要指定 repo',
    path: ['config', 'repo'],
  }
).refine(
  (data) => {
    if (data.type === 'git-local') {
      return true
    }
    return data.config.token && data.config.token.length > 0
  },
  {
    message: '远程仓库需要提供 token',
    path: ['config', 'token'],
  }
)

export type CollectSourceInput = z.infer<typeof collectSourceSchema>