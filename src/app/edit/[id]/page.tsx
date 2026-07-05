'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MilkdownEditor } from '@/components/editor/MilkdownEditor'
import { CheckPanel } from '@/components/CheckPanel'
import { ScorePanel } from '@/components/ScorePanel'
import { VariableToolbar } from '@/components/VariableToolbar'
import { EditorSidebar } from '@/components/EditorSidebar'
import { ViewSwitcher } from '@/components/ViewSwitcher'
import { ExportDialog } from '@/components/ExportDialog'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Report, AIStyle } from '@/lib/db/schema'

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const [styleOverride, setStyleOverride] = useState<AIStyle | undefined>()
  const [currentView, setCurrentView] = useState<'leadership' | 'personal'>('personal')
  const [viewLoading, setViewLoading] = useState(false)
  const [baseContent, setBaseContent] = useState('')

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/${id}`)
        if (response.ok) {
          const report: Report = await response.json()
          setTitle(report.title)
          setContent(report.content)
          setBaseContent(report.content)
          setWeekStart(report.weekStart)
          setWeekEnd(report.weekEnd)
        } else {
          toast.error('周报不存在')
          router.push('/')
        }
      } catch (error) {
        toast.error('加载失败')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id, router])

  function handleInsertVariable(variable: string) {
    setContent(prev => prev + '\n' + variable + '\n')
    setEditorKey(k => k + 1)
    toast.success(`已插入变量：${variable}`)
  }

  function handleStyleChange(style: AIStyle) {
    setStyleOverride(style)
    toast.success('已应用AI风格')
  }

  function handleSelectSnippet(snippet: string) {
    setContent(prev => prev + '\n' + snippet + '\n')
    setEditorKey(k => k + 1)
    toast.success('已插入片段')
  }

  function handlePolish(polishedContent: string) {
    // Replace the entire content with polished version
    setContent(polishedContent)
    setEditorKey(k => k + 1)
  }

  function handleExpand(expandedContent: string) {
    // Insert expanded content at the end
    setContent(prev => prev + '\n\n' + expandedContent)
    setEditorKey(k => k + 1)
  }

  function handleUnify(unifiedContent: string) {
    // Replace entire content with unified version
    setContent(unifiedContent)
    setEditorKey(k => k + 1)
  }

  async function handleViewChange(view: 'leadership' | 'personal') {
    if (view === currentView) return

    setViewLoading(true)

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: baseContent,
          templateId: 'official-general',
          viewType: view,
        })
      })

      if (!response.ok) {
        throw new Error('视图渲染失败')
      }

      const data = await response.json()
      setContent(data.content)
      setCurrentView(view)
      setEditorKey(k => k + 1)

      toast.success(`已切换到${view === 'leadership' ? '领导版' : '个人版'}视图`)
    } catch {
      toast.error('视图切换失败，请重试')
    } finally {
      setViewLoading(false)
    }
  }

  const getEditorContent = () => content

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      toast.error('请填写所有必填项')
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          weekStart,
          weekEnd,
        }),
      })

      if (response.ok) {
        toast.success('周报已更新')
        router.push('/')
      } else {
        const error = await response.json()
        toast.error(error.error || '保存失败')
      }
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="text-center">加载中...</div>
      </main>
    )
  }

  return (
    <main className="h-screen flex flex-col">
      <div className="container mx-auto px-4 py-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">编辑周报</h1>
          <ViewSwitcher
            currentView={currentView}
            onViewChange={handleViewChange}
            isLoading={viewLoading}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            <form className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>开始日期（周一）</Label>
                  <div className="text-sm text-muted-foreground py-1.5">{weekStart}</div>
                </div>
                <div className="space-y-2">
                  <Label>结束日期（周日）</Label>
                  <div className="text-sm text-muted-foreground py-1.5">{weekEnd}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>内容</Label>
                    <VariableToolbar onInsertVariable={handleInsertVariable} />
                  </div>
                  <MilkdownEditor key={editorKey} value={content} onChange={setContent} />
                </div>
                <div>
                  <CheckPanel content={content} />
                </div>
              </div>

              {showScorePanel ? (
                <ScorePanel
                  content={content}
                  onConfirm={handleSubmit}
                  onCancel={() => setShowScorePanel(false)}
                />
              ) : (
                <div className="flex justify-end gap-4">
                  <Link href="/">
                    <Button type="button" variant="outline">
                      取消
                    </Button>
                  </Link>
                  <ExportDialog content={baseContent} templateId="official-general" />
                  <Button type="button" onClick={() => setShowScorePanel(true)} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0">
          <EditorSidebar
            reportId={parseInt(id)}
            onStyleChange={handleStyleChange}
            onSelectSnippet={handleSelectSnippet}
            onPolish={handlePolish}
            onExpand={handleExpand}
            onUnify={handleUnify}
            getEditorContent={getEditorContent}
          />
        </div>
      </div>
    </main>
  )
}