'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import dynamic from 'next/dynamic'

const MilkdownEditor = dynamic(
  () => import('@/components/editor/MilkdownEditor').then(m => ({ default: m.MilkdownEditor })),
  { ssr: false }
)
import type { OfficialTemplate } from '@/lib/official-templates'

interface ViewTemplateDialogProps {
  template: OfficialTemplate | null
  open: boolean
  onClose: () => void
}

export function ViewTemplateDialog({
  template,
  open,
  onClose,
}: ViewTemplateDialogProps) {
  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            {template.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {template.tags.length > 0 && (
            <div className="text-sm text-muted-foreground">
              标签: {template.tags.join(', ')}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium">模板内容</div>
            <div className="border rounded-md p-4 max-h-[60vh] overflow-y-auto">
              <MilkdownEditor value={template.content} onChange={() => {}} readOnly />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
