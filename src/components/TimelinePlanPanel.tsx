'use client'

import { useEffect, useState } from 'react'
import { Briefcase, LoaderCircle, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TimelinePlanProjection } from '@/lib/reports/next-week-plan'

type Audience = 'leadership' | 'personal'
type TimelinePlanData = {
  previousCycle: { weekStart: string; weekEnd: string }
  plans: Record<Audience, TimelinePlanProjection>
}

const labels: Record<Audience, string> = { leadership: 'Leadership', personal: 'Personal' }

function PlanContent({ plan }: { plan: TimelinePlanProjection }) {
  if (plan.status === 'found') {
    return (
      <div className="space-y-3">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {plan.items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
        {plan.warning && <p role="alert" className="text-xs text-amber-600 dark:text-amber-400">{plan.warning}</p>}
      </div>
    )
  }

  return (
    <div role={plan.status === 'parse-failed' ? 'alert' : 'status'} className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      {plan.reason}
    </div>
  )
}

export function TimelinePlanPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<TimelinePlanData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [audience, setAudience] = useState<Audience>('leadership')

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/timeline/plans', { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as TimelinePlanData & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'Failed to load timeline plans')
        setData(payload)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Failed to load timeline plans')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [refreshKey])

  return (
    <Card role="region" aria-label="Timeline plans">
      <CardHeader>
        <CardTitle>Timeline plans</CardTitle>
        <p className="text-xs text-muted-foreground">Read-only previous-cycle plan projection</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div role="alert" className="py-3 text-sm text-destructive">{error}</div>
        ) : data ? (
          <Tabs value={audience} onValueChange={(value) => setAudience(value as Audience)}>
            <TabsList className="w-full">
              <TabsTrigger value="leadership"><Briefcase className="h-4 w-4" />{labels.leadership}</TabsTrigger>
              <TabsTrigger value="personal"><User className="h-4 w-4" />{labels.personal}</TabsTrigger>
            </TabsList>
            {(['leadership', 'personal'] as Audience[]).map((item) => {
              const plan = data.plans[item]
              return (
                <TabsContent key={item} value={item} className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Previous cycle: {data.previousCycle.weekStart} – {data.previousCycle.weekEnd}</span>
                    {plan.source && <Badge variant="outline">Source: {plan.source.audience} · {plan.source.finalStatus}</Badge>}
                  </div>
                  <PlanContent plan={plan} />
                </TabsContent>
              )
            })}
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  )
}
