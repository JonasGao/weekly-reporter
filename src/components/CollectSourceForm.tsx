'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { UserCircle } from 'lucide-react'
import { AuthorEmailPicker } from './AuthorEmailPicker'
import { AutoCompleteInput } from './AutoCompleteInput'
import { TagInput } from './TagInput'

export interface FormData {
  type: 'git-remote-github' | 'git-remote-gitlab' | 'git-remote-gitee' | 'git-local'
  name: string
  projectScope: 'work' | 'personal'
  aliases: string[]
  config: {
    baseUrl: string
    owner: string
    repo: string
    token: string
    authorEmails: string
    branches: string
  }
  enabled: boolean
}

const isLocal = (type: FormData['type']) => type === 'git-local'
const isRemote = (type: FormData['type']) => !isLocal(type)

export function CollectSourceForm({ sourceId, initialData }: { sourceId?: number; initialData?: FormData }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>(
    initialData || {
      type: 'git-remote-github',
      name: '',
      projectScope: 'personal',
      aliases: [],
      config: {
        baseUrl: '',
        owner: '',
        repo: '',
        token: '',
        authorEmails: '',
        branches: '',
      },
      enabled: true,
    }
  )

  // 邮箱自动补全 — 从当前仓库获取
  const [knownEmails, setKnownEmails] = useState<string[]>([])
  // 分支自动补全 — 从当前仓库获取
  const [knownBranches, setKnownBranches] = useState<string[]>([])

  // 邮箱表格选择器
  const [pickerOpen, setPickerOpen] = useState(false)

  // 根据当前表单值获取仓库邮箱（防抖）
  useEffect(() => {
    const params = new URLSearchParams({ type: formData.type })
    if (isLocal(formData.type)) {
      if (!formData.config.owner) return
      params.set('path', formData.config.owner)
    } else {
      if (!formData.config.owner || !formData.config.repo || !formData.config.token) return
      params.set('owner', formData.config.owner)
      params.set('repo', formData.config.repo)
      params.set('token', formData.config.token)
      if (formData.config.baseUrl) params.set('baseUrl', formData.config.baseUrl)
    }
    // Use first branch for email fetching
    const firstBranch = formData.config.branches.split(',')[0]?.trim()
    if (firstBranch) params.set('branch', firstBranch)

    const timer = setTimeout(() => {
      fetch(`/api/collect/sources/emails?${params}`)
        .then(res => res.json())
        .then(data => setKnownEmails((data.authors || []).map((a: { email: string }) => a.email)))
        .catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.type, formData.config.owner, formData.config.repo, formData.config.token, formData.config.baseUrl, formData.config.branches])

  // 根据当前表单值获取仓库分支（防抖）
  useEffect(() => {
    const params = new URLSearchParams({ type: formData.type })
    if (isLocal(formData.type)) {
      if (!formData.config.owner) return
      params.set('path', formData.config.owner)
    } else {
      if (!formData.config.owner || !formData.config.repo || !formData.config.token) return
      params.set('owner', formData.config.owner)
      params.set('repo', formData.config.repo)
      params.set('token', formData.config.token)
      if (formData.config.baseUrl) params.set('baseUrl', formData.config.baseUrl)
    }

    const timer = setTimeout(() => {
      fetch(`/api/collect/sources/branches?${params}`)
        .then(res => res.json())
        .then(data => setKnownBranches(data.branches || []))
        .catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.type, formData.config.owner, formData.config.repo, formData.config.token, formData.config.baseUrl])

  function handleChange(field: keyof FormData, value: string | boolean) {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  function handleConfigChange(field: keyof FormData['config'], value: string) {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value,
      },
    }))
  }

  function handleAliasesChange(aliases: string[]) {
    setFormData(prev => ({ ...prev, aliases }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const submitData = {
      type: formData.type,
      name: formData.name,
      projectScope: formData.projectScope,
      aliases: formData.aliases,
      config: isLocal(formData.type)
        ? {
          owner: formData.config.owner,
          authorEmails: formData.config.authorEmails.split(',').map(e => e.trim()).filter(Boolean),
          branches: formData.config.branches.split(',').map(b => b.trim()).filter(Boolean) || undefined,
        }
        : {
          baseUrl: formData.config.baseUrl || undefined,
          owner: formData.config.owner,
          repo: formData.config.repo,
          token: formData.config.token,
          authorEmails: formData.config.authorEmails.split(',').map(e => e.trim()).filter(Boolean),
          branches: formData.config.branches.split(',').map(b => b.trim()).filter(Boolean) || undefined,
        },
      enabled: formData.enabled,
    }

    try {
      const url = sourceId 
        ? `/api/collect/sources/${sourceId}`
        : '/api/collect/sources'
      const method = sourceId ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast.success(sourceId ? '更新成功' : '创建成功')
        router.push('/collect')
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-visible">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CardHeader>
          <CardTitle>配置信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">采集源名称</Label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="例如：后端主仓库"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>项目范围</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="projectScope"
                  value="work"
                  checked={formData.projectScope === 'work'}
                  onChange={() => handleChange('projectScope', 'work')}
                  className="rounded border-input"
                />
                <span className="text-sm">工作项目</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="projectScope"
                  value="personal"
                  checked={formData.projectScope === 'personal'}
                  onChange={() => handleChange('projectScope', 'personal')}
                  className="rounded border-input"
                />
                <span className="text-sm">个人项目</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              工作项目会显示在领导版周报中，个人项目仅在个人版周报中显示
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aliases">别名</Label>
            <TagInput
              value={formData.aliases}
              onChange={handleAliasesChange}
              placeholder="例如：后端服务, API平台"
            />
            <p className="text-xs text-muted-foreground">
              帮助 AI 识别这个项目，别名会显示在事件中
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">采集类型</Label>
            <select
              id="type"
              value={formData.type}
              onChange={e => handleChange('type', e.target.value as FormData['type'])}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="git-remote-github">GitHub（远程）</option>
              <option value="git-remote-gitlab">GitLab（远程）</option>
              <option value="git-local">本地 Git 仓库</option>
              <option value="git-remote-gitee">Gitee（暂不支持）</option>
            </select>
          </div>

          {isRemote(formData.type) && formData.type === 'git-remote-gitlab' && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">GitLab 地址（自建实例填写，公有云留空）</Label>
              <input
                id="baseUrl"
                type="text"
                value={formData.config.baseUrl}
                onChange={e => handleConfigChange('baseUrl', e.target.value)}
                placeholder="例如：https://gitlab.example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="owner">
              {isLocal(formData.type) ? '本地仓库路径' : '仓库所属组织/用户名'}
            </Label>
            <input
              id="owner"
              type="text"
              value={formData.config.owner}
              onChange={e => handleConfigChange('owner', e.target.value)}
              placeholder={isLocal(formData.type) ? '例如：/home/user/projects/backend' : '例如：my-org'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          {isRemote(formData.type) && (
            <div className="space-y-2">
              <Label htmlFor="repo">仓库名</Label>
              <input
                id="repo"
                type="text"
                value={formData.config.repo}
                onChange={e => handleConfigChange('repo', e.target.value)}
                placeholder="例如：backend-api"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="branches">分支（可选，多个用逗号分隔，默认主分支）</Label>
            <AutoCompleteInput
              value={formData.config.branches}
              onChange={v => handleConfigChange('branches', v)}
              suggestions={knownBranches}
              placeholder="例如：main, develop"
            />
          </div>

          {isRemote(formData.type) && (
            <div className="space-y-2">
              <Label htmlFor="token">个人访问令牌</Label>
              <input
                id="token"
                type="password"
                value={formData.config.token}
                onChange={e => handleConfigChange('token', e.target.value)}
                placeholder="请输入访问令牌"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.type === 'git-remote-github' 
                  ? 'GitHub: Settings → Developer settings → Personal access tokens'
                  : 'GitLab: Settings → Access tokens'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="authorEmails">作者邮箱（多个用逗号分隔）</Label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <UserCircle className="h-3.5 w-3.5" />
                从仓库选择
              </button>
            </div>
            <AutoCompleteInput
              value={formData.config.authorEmails}
              onChange={v => handleConfigChange('authorEmails', v)}
              suggestions={knownEmails}
              placeholder="例如：user@example.com, work@company.com"
              allowCreate
            />
            <p className="text-xs text-muted-foreground">
              只采集这些邮箱的提交记录
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="enabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={e => handleChange('enabled', e.target.checked)}
              className="rounded border-input"
            />
            <Label htmlFor="enabled">启用此采集源</Label>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/collect')}>
            取消
          </Button>
        </CardFooter>
      </form>

      <AuthorEmailPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={emails => handleConfigChange('authorEmails', emails.join(', '))}
        currentEmails={formData.config.authorEmails.split(',').map(e => e.trim()).filter(Boolean)}
        repoParams={{
          type: formData.type,
          path: isLocal(formData.type) ? formData.config.owner : undefined,
          owner: formData.config.owner,
          repo: formData.config.repo,
          token: formData.config.token,
          baseUrl: formData.config.baseUrl,
          branch: formData.config.branches.split(',')[0]?.trim() || undefined,
        }}
      />
    </Card>
  )
}