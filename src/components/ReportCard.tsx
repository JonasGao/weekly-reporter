'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { Report } from '@/lib/db/schema'
import { formatSystemDate } from '@/lib/time-format'

interface ReportCardProps {
  report: Report
  onDelete: (id: number) => void
}

export function ReportCard({ report, onDelete }: ReportCardProps) {
  const weekStart = formatSystemDate(report.weekStart)
  const weekEnd = formatSystemDate(report.weekEnd)
  const createdAt = formatSystemDate(report.createdAt)

  return (
    <a href={`/reports/${report.id}`} className="block">
      <Card className="hover:shadow-md hover:border-[#333] hover:bg-[#161616] transition-all cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4 max-[720px]:flex-col">
            <CardTitle className="text-lg flex-1 max-[720px]:pr-0">{report.title}</CardTitle>
            <div className="flex gap-2 items-center max-[720px]:w-full max-[720px]:justify-end max-[720px]:mt-2">
              <Link href={`/edit/${report.id}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(report.id)
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <span suppressHydrationWarning>{weekStart} - {weekEnd}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Created <span suppressHydrationWarning>{createdAt}</span>
          </p>
        </CardContent>
      </Card>
    </a>
  )
}
