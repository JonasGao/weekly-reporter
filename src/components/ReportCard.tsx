'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import type { Report } from '@/lib/db/schema'

interface ReportCardProps {
  report: Report
  onDelete: (id: number) => void
}

export function ReportCard({ report, onDelete }: ReportCardProps) {
  const weekStart = format(new Date(report.weekStart), 'MM/dd', { locale: zhCN })
  const weekEnd = format(new Date(report.weekEnd), 'MM/dd', { locale: zhCN })
  const createdAt = format(new Date(report.createdAt), 'yyyy-MM-dd', { locale: zhCN })

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{report.title}</CardTitle>
          <div className="flex gap-2">
            <Link href={`/edit/${report.id}`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(report.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {weekStart} - {weekEnd}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          创建于 {createdAt}
        </p>
      </CardContent>
    </Card>
  )
}