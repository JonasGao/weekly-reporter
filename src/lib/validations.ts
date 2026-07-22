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
  projectScope: z.enum(['work', 'personal']),
  aliases: z.array(z.string().min(1).max(100)).max(20).optional(),
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

// --- AI 风格校验 ---

const styleKeyRegex = /^[a-z][a-z0-9_-]*$/

export const aiStyleSchema = z.object({
  key: z.string().min(1, '标识不能为空').max(50).regex(styleKeyRegex, '标识只能包含小写字母、数字、连字符和下划线，且必须以字母开头'),
  label: z.string().min(1, '名称不能为空').max(50),
  systemPrompt: z.string().min(1, '提示词不能为空').max(5000),
  temperature: z.number().min(0).max(2).default(0.3),
  scoreStructureWeight: z.number().int().min(0).max(100).default(25),
  scoreContentWeight: z.number().int().min(0).max(100).default(30),
  scoreValueWeight: z.number().int().min(0).max(100).default(45),
  detailLevel: z.enum(['low', 'medium', 'high']).optional(),
  resultOriented: z.enum(['low', 'medium', 'high']).optional(),
  isDefault: z.boolean().optional(),
})

export type AIStyleInput = z.infer<typeof aiStyleSchema>

// --- 系统提示词校验 ---

export const systemPromptSchema = z.object({
  promptText: z.string().min(1, '提示词不能为空').max(10000),
})

export type SystemPromptInput = z.infer<typeof systemPromptSchema>