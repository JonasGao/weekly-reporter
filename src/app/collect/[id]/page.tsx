'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CollectSourceForm } from '@/components/CollectSourceForm'
import type { FormData } from '@/components/CollectSourceForm'
import { toast } from 'sonner'

export default function EditCollectSourcePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState<number | null>(null)
  const [initialData, setInitialData] = useState<FormData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(p => {
      const sourceId = parseInt(p.id)
      if (isNaN(sourceId)) {
        toast.error('无效的采集源ID')
        router.push('/collect')
        return
      }
      setId(sourceId)
      fetchSource(sourceId)
    })
  }, [params, router])

  async function fetchSource(sourceId: number) {
    try {
      const res = await fetch(`/api/collect/sources/${sourceId}`)
      const data = await res.json()
      
      if (!res.ok) {
        toast.error(data.error || '获取采集源失败')
        router.push('/collect')
        return
      }
      
      setInitialData({
        type: data.type,
        name: data.name,
        config: {
          baseUrl: data.config.baseUrl || '',
          owner: data.config.owner,
          repo: data.config.repo || '',
          token: '',
          branches: Array.isArray(data.config.branches)
            ? data.config.branches.map((b: string | { name: string }) => typeof b === 'string' ? b : b.name).join(', ')
            : '',
          authorEmails: Array.isArray(data.config.authorEmails) ? data.config.authorEmails.join(',') : '',
        },
        enabled: data.enabled,
      })
    } catch (error) {
      toast.error('获取采集源失败')
      router.push('/collect')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="text-center">加载中...</div>
      </main>
    )
  }

  if (!id || !initialData) {
    return null
  }

  return (
    <main className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">编辑采集源</h1>
      <CollectSourceForm sourceId={id} initialData={initialData} />
    </main>
  )
}