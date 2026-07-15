'use client'

import { useMemo } from 'react'

export interface HeatmapData {
  date: string
  count: number
}

interface ActivityHeatmapProps {
  data: HeatmapData[]
  selectedDate: string | null
  onDateSelect: (date: string | null) => void
}

function getLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const heatmapColors = [
  'var(--color-heatmap-0)',
  'var(--color-heatmap-1)',
  'var(--color-heatmap-2)',
  'var(--color-heatmap-3)',
  'var(--color-heatmap-4)',
]

export function ActivityHeatmap({ data, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentMonday = getMonday(today)

    const startDate = new Date(currentMonday)
    startDate.setDate(startDate.getDate() - 52 * 7)

    const countMap = new Map<string, number>()
    for (const entry of data) {
      countMap.set(entry.date, entry.count)
    }

    const weeks: Array<Array<{ date: string; count: number }>> = []
    const current = new Date(startDate)
    while (current <= today) {
      const week: Array<{ date: string; count: number }> = []
      for (let day = 0; day < 7; day++) {
        if (current <= today) {
          const dateStr = formatDate(current)
          week.push({ date: dateStr, count: countMap.get(dateStr) || 0 })
        }
        current.setDate(current.getDate() + 1)
      }
      if (week.length > 0) weeks.push(week)
    }

    // Month labels: position at the first week of each month
    const labels: Array<{ month: number; pct: number }> = []
    let lastMonth = -1
    weeks.forEach((week, idx) => {
      const firstDay = week[0]
      if (firstDay) {
        const d = new Date(firstDay.date + 'T00:00:00')
        const month = d.getMonth() + 1
        if (month !== lastMonth) {
          labels.push({ month, pct: (idx / weeks.length) * 100 })
          lastMonth = month
        }
      }
    })

    return { weeks, monthLabels: labels }
  }, [data])

  const numWeeks = weeks.length

  return (
    <div className="rounded-lg border border-border p-3">
      {numWeeks === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">暂无数据</div>
      ) : (
        <div className="flex gap-1.5">
          {/* Weekday labels */}
          <div className="flex flex-col shrink-0 text-[10px] leading-none text-muted-foreground" style={{ gap: '2px', paddingTop: '18px' }}>
            {WEEKDAYS.map((day, i) => (
              <div key={i} className="w-4 text-right pr-1" style={{ height: '10px' }}>
                {i % 2 === 0 ? day : ''}
              </div>
            ))}
          </div>

          {/* Grid area — single row, fills parent width */}
          <div className="flex-1 min-w-0">
            {/* Month labels */}
            <div className="relative h-4 text-[10px] text-muted-foreground mb-0.5">
              {monthLabels.map(({ month, pct }) => (
                <span
                  key={month}
                  className="absolute top-0"
                  style={{ left: `${pct}%` }}
                >
                  {month}月
                </span>
              ))}
            </div>

            {/* Weeks grid: column-major, each week is a column of 7 day-cells */}
            <div
              className="grid gap-[2px]"
              style={{
                gridTemplateRows: 'repeat(7, 1fr)',
                gridAutoFlow: 'column',
                gridTemplateColumns: `repeat(${numWeeks}, 1fr)`,
              }}
            >
              {weeks.flatMap((week, weekIdx) =>
                week.map(({ date, count }) => {
                  const level = getLevel(count)
                  const isSelected = date === selectedDate
                  return (
                    <div
                      key={date}
                      data-count={count}
                      data-level={level}
                      data-selected={isSelected ? 'true' : undefined}
                      title={`${count} 条事件 · ${date}`}
                      className="aspect-square rounded-[2px] cursor-pointer transition-colors min-w-0"
                      style={{
                        backgroundColor: heatmapColors[level],
                        outline: isSelected ? '1.5px solid var(--foreground)' : 'none',
                        outlineOffset: '-1px',
                      }}
                      onClick={() => onDateSelect(date === selectedDate ? null : date)}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
