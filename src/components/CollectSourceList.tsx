'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2, Edit, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface CollectSource {
  id: number
  type: string
  name: string
  config: {
    baseUrl?: string
    owner: string
    repo: string
    token: string
    authorEmails: string[]
    branch?: string
  }
  enabled: boolean
  lastSyncAt: string | null
  lastSyncStatus: string | null
  createdAt: string
  updatedAt: string
}

export function CollectSourceList({ onRefresh }: { onRefresh?: (fetchFn: () => void) => void }) {
  const [sources, setSources] = useState<CollectSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSources()
    if (onRefresh) {
      onRefresh(fetchSources)
    }
  }, [onRefresh])

  async function fetchSources() {
    try {
      const res = await fetch('/api/collect/sources')
      const data = await res.json()
      setSources(data.sources || [])
    } catch (error) {
      toast.error('获取采集源列表失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleSync(sourceId: number) {
    try {
      toast.info('开始同步...')
      const res = await fetch('/api/collect/git-remote/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      })
      const data = await res.json()
      
      if (data.result?.status === 'success') {
        toast.success(`同步成功，新增 ${data.result.eventsCount} 条事件`)
      } else {
        toast.error(data.error || '同步失败')
      }
      
      fetchSources()
    } catch (error) {
      toast.error('同步失败')
    }
  }

  async function handleDelete(sourceId: number) {
    if (!confirm('确定要删除此采集源吗？')) return
    
    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success('删除成功')
        fetchSources()
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch (error) {
      toast.error('删除失败')
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">暂无采集源</p>
          <Link href="/collect/new">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              添加采集源
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {sources.map(source => (
        <Card key={source.id}>
          <CardHeader>
            <CardTitle>{source.name}</CardTitle>
            <CardDescription>
              {source.config.owner}/{source.config.repo}
              {source.config.branch && ` (${source.config.branch})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>类型: {source.type}</p>
              <p>
                状态: 
                <span className={source.enabled ? 'text-green-600' : 'text-red-600'}>
                  {source.enabled ? '已启用' : '已禁用'}
                </span>
              </p>
              <p>
                上次同步: 
                {source.lastSyncAt 
                  ? new Date(source.lastSyncAt).toLocaleString()
                  : '未同步'}
                {source.lastSyncStatus && (
                  <span className={source.lastSyncStatus === 'success' ? 'text-green-600' : 'text-red-600'}>
                    ({source.lastSyncStatus === 'success' ? '成功' : '失败'})
                  </span>
                )}
              </p>
              <p>作者邮箱: {source.config.authorEmails.join(', ')}</p>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm" onClick={() => handleSync(source.id)}>
              <RefreshCw className="h-3 w-3 mr-1" />
              同步
            </Button>
            <Link href={`/collect/${source.id}`}>
              <Button size="sm" variant="outline">
                <Edit className="h-3 w-3 mr-1" />
                编辑
              </Button>
            </Link>
            <Button size="sm" variant="destructive" onClick={() => handleDelete(source.id)}>
              <Trash2 className="h-3 w-3 mr-1" />
              删除
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}