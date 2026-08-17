'use client'

import { useParams } from 'next/navigation'
import { ReportWorkspace } from '@/components/ReportWorkspace'

export default function EditReportPage() {
  const params = useParams<{ id: string }>()
  return <ReportWorkspace reportId={Number.parseInt(params.id, 10)} editable />
}
