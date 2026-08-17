import { ReportWorkspace } from '@/components/ReportWorkspace'

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReportWorkspace reportId={Number.parseInt(id, 10)} editable={false} />
}
