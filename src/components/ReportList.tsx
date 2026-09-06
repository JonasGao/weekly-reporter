'use client'

import { useState, useEffect } from 'react'
import { ReportCard } from './ReportCard'
import { SearchBar } from './SearchBar'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { Report, ScoreStatus } from '@/lib/db/schema'

interface ScoreUpdate {
  reportId: number
  variant?: 'leadership' | 'personal'
  scoreStatus: ScoreStatus
  scoreStructure?: number | null
  scoreContent?: number | null
  scoreValue?: number | null
  scoreOverall?: number | null
  suggestions?: string[] | null
  scoreError?: string | null
}

export function ReportList() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchReports() {
    try {
      const response = await fetch('/api/reports')
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/reports')
        const data = await response.json()
        if (!cancelled) {
          setReports(data.reports || [])
        }
      } catch (error) {
        if (!cancelled) {
          toast.error('Failed to load reports')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])
  
  useEffect(() => {
    const eventSource = new EventSource('/api/reports/score-stream')
    
    eventSource.onmessage = (event) => {
      try {
        const update: ScoreUpdate = JSON.parse(event.data)
        if (update.variant && update.variant !== 'personal') return
        setReports(prev => prev.map(report => {
          if (report.id === update.reportId) {
            return {
              ...report,
              scoreStatus: update.scoreStatus,
              scoreStructure: update.scoreStructure ?? report.scoreStructure,
              scoreContent: update.scoreContent ?? report.scoreContent,
              scoreValue: update.scoreValue ?? report.scoreValue,
              scoreOverall: update.scoreOverall ?? report.scoreOverall,
              suggestions: update.suggestions ? update.suggestions.join('\n') : report.suggestions,
              scoreError: update.scoreError ?? report.scoreError,
            }
          }
          return report
        }))
      } catch (error) {
        console.error('[SSE] Failed to parse update:', error)
      }
    }
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error)
    }
    
    return () => {
      eventSource.close()
    }
  }, [])

  async function handleSearch(query: string) {
    if (!query.trim()) {
      fetchReports()
      return
    }

    try {
      const response = await fetch(`/api/reports/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      toast.error('Search failed')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this report?')) return

    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setReports(reports.filter((r) => r.id !== id))
        toast.success('Report deleted')
      }
    } catch (error) {
      toast.error('Delete failed')
    }
  }
  
  async function handleRetry(id: number) {
    try {
      const response = await fetch(`/api/reports/${id}/rescore`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const error = await response.json()
        toast.error(error.error || 'Rescoring failed')
      }
    } catch (error) {
      toast.error('Rescoring failed')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold max-[720px]:text-[24px]">Weekly Reporter</h1>
        <div className="flex items-center gap-2">
          <Link href="/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New report
            </Button>
          </Link>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} />

      {reports.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No reports yet. Click &quot;New report&quot; to get started.
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}
    </div>
  )
}
