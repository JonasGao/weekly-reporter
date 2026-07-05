'use client'

import { useState } from 'react'
import { Download, Briefcase, User, FileText } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ExportDialogProps {
  content: string
  templateId: string
}

export function ExportDialog({ content, templateId }: ExportDialogProps) {
  const [selectedView, setSelectedView] = useState<'leadership' | 'personal'>('personal')
  const [isExporting, setIsExporting] = useState(false)
  const [open, setOpen] = useState(false)

  async function handleExport() {
    setIsExporting(true)

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          templateId,
          viewType: selectedView,
          format: 'markdown',
        })
      })

      if (!response.ok) {
        throw new Error('导出失败')
      }

      const data = await response.json()

      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `周报-${selectedView === 'leadership' ? '领导版' : '个人版'}.md`
      a.click()
      URL.revokeObjectURL(url)

      toast.success('导出成功')
      setOpen(false)
    } catch {
      toast.error('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          导出周报
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>导出周报</DialogTitle>
        <DialogDescription>
          选择导出视图，生成差异化周报文件
        </DialogDescription>
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label className="text-base">导出视图</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  selectedView === 'leadership'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setSelectedView('leadership')}
              >
                <Briefcase className="h-5 w-5" />
                <span className="text-sm font-medium">领导版</span>
                <span className="text-xs text-muted-foreground">精炼汇报</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
                  selectedView === 'personal'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                )}
                onClick={() => setSelectedView('personal')}
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">个人版</span>
                <span className="text-xs text-muted-foreground">完整复盘</span>
              </button>
            </div>
          </div>

          <Button onClick={handleExport} disabled={isExporting} className="w-full gap-2">
            <FileText className="h-4 w-4" />
            {isExporting ? '导出中...' : '确认导出 Markdown'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
