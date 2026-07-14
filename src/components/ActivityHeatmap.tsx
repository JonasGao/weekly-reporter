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
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const WEEKS_PER_ROW = 13

export function ActivityHeatmap({ data, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const { weeks, months } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentMonday = getMonday(today)

    // Go back 52 weeks from current Monday
    const startDate = new Date(currentMonday)
    startDate.setDate(startDate.getDate() - 52 * 7)

    // Build count map
    const countMap = new Map<string, number>()
    for (const entry of data) {
      countMap.set(entry.date, entry.count)
    }

    // Build weeks (columns)
    const weeks: Array<Array<{ date: string; count: number; dayOfWeek: number }>> = []
    const current = new Date(startDate)
    while (current <= today) {
      const week: Array<{ date: string; count: number; dayOfWeek: number }> = []
      for (let day = 0; day < 7; day++) {
        if (current <= today) {
          const dateStr = formatDate(current)
          week.push({
            date: dateStr,
            count: countMap.get(dateStr) || 0,
            dayOfWeek: day,
          })
        }
        current.setDate(current.getDate() + 1)
      }
      if (week.length > 0) {
        weeks.push(week)
      }
    }

    // Fold into rows of WEEKS_PER_ROW weeks each
    const rows: typeof weeks[] = []
    for (let i = 0; i < weeks.length; i += WEEKS_PER_ROW) {
      rows.push(weeks.slice(i, i + WEEKS_PER_ROW))
    }

    // Calculate month label positions (per row)
    const monthRows = rows.map(row => {
      const labels: Array<{ month: number; col: number }> = []
      let lastMonth = -1
      row.forEach((week, colIdx) => {
        const firstDay = week[0]
        if (firstDay) {
          const d = new Date(firstDay.date + 'T00:00:00')
          const month = d.getMonth() + 1
          if (month !== lastMonth) {
            labels.push({ month, col: colIdx })
            lastMonth = month
          }
        }
      })
      return labels
    })

    return { weeks, months: monthRows }
  }, [data])

  const heatmapColors = [
    'var(--color-heatmap-0)',
    'var(--color-heatmap-1)',
    'var(--color-heatmap-2)',
    'var(--color-heatmap-3)',
    'var(--color-heatmap-4)',
  ]

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex gap-1">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[2px] text-[10px] text-muted-foreground pt-[18px]">
          {WEEKDAYS.map((day, i) => (
            <div
              key={i}
              className="h-[10px] leading-[10px] w-4 text-right pr-1"
            >
              {i % 2 === 0 ? day : ''}
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div className="flex-1 min-w-0 space-y-1">
          {weeks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">暂无数据</div>
          ) : (
            months.map((monthLabels, rowIdx) => (
              <div key={rowIdx}>
                {/* Month labels for this row */}
                <div className="relative h-4 text-[10px] text-muted-foreground">
                  {monthLabels.map(({ month, col }) => (
                    <span
                      key={`${rowIdx}-${month}`}
                      className="absolute top-0"
                      style={{ left: `calc(${col} * 12px)` }}
                    >
                      {month}月
                    </span>
                  ))}
                </div>

                {/* Weeks grid for this row */}
                <div className="flex gap-[2px]">
                  {weeks.slice(rowIdx * WEEKS_PER_ROW, (rowIdx + 1) * WEEKS_PER_ROW).map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-[2px]">
                      {week.map(({ date, count, dayOfWeek }) => {
                        const level = getLevel(count)
                        const isSelected = date === selectedDate
                        return (
                          <div
                            key={date}
                            data-count={count}
                            data-level={level}
                            data-selected={isSelected ? 'true' : undefined}
                            title={`${count} 条事件 · ${date}`}
                            className="h-[10px] w-[10px] rounded-[2px] cursor-pointer transition-colors"
                            style={{
                              backgroundColor: heatmapColors[level],
                              outline: isSelected ? '1px solid var(--foreground)' : 'none',
                              outlineOffset: '-1px',
                            }}
                            onClick={() => {
                              onDateSelect(date === selectedDate ? null : date)
                            }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
