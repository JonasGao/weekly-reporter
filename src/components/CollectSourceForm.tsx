'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export interface FormData {
  type: 'git-remote-github' | 'git-remote-gitlab' | 'git-remote-gitee' | 'git-local'
  name: string
  config: {
    baseUrl: string
    owner: string
    repo: string
    token: string
    authorEmails: string
    branch: string
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
      config: {
        baseUrl: '',
        owner: '',
        repo: '',
        token: '',
        authorEmails: '',
        branch: '',
      },
      enabled: true,
    }
  )

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const submitData = {
      type: formData.type,
      name: formData.name,
      config: isLocal(formData.type)
        ? {
          owner: formData.config.owner,
          authorEmails: formData.config.authorEmails.split(',').map(e => e.trim()).filter(Boolean),
          branch: formData.config.branch || undefined,
        }
        : {
          baseUrl: formData.config.baseUrl || undefined,
          owner: formData.config.owner,
          repo: formData.config.repo,
          token: formData.config.token,
          authorEmails: formData.config.authorEmails.split(',').map(e => e.trim()).filter(Boolean),
          branch: formData.config.branch || undefined,
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
    <Card>
      <form onSubmit={handleSubmit}>
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
            <Label htmlFor="branch">分支（可选，默认主分支）</Label>
            <input
              id="branch"
              type="text"
              value={formData.config.branch}
              onChange={e => handleConfigChange('branch', e.target.value)}
              placeholder="例如：develop"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <Label htmlFor="authorEmails">作者邮箱（多个用逗号分隔）</Label>
            <input
              id="authorEmails"
              type="text"
              value={formData.config.authorEmails}
              onChange={e => handleConfigChange('authorEmails', e.target.value)}
              placeholder="例如：user@example.com, work@company.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
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
    </Card>
  )
}