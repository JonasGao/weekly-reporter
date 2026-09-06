'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
  if (count <= 9) return 3
  if (count <= 14) return 4
  if (count <= 20) return 5
  return 6
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

function getWeekdays(): string[] {
  // 2024-01-01 is a Monday; labels follow the browser's locale.
  const monday = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date)
  })
}

const heatmapColors = [
  'var(--color-heatmap-0)',
  'var(--color-heatmap-1)',
  'var(--color-heatmap-2)',
  'var(--color-heatmap-3)',
  'var(--color-heatmap-4)',
  'var(--color-heatmap-5)',
  'var(--color-heatmap-6)',
]

const CELL_SIZE = 10
const GAP = 2
const LABEL_COL_WIDTH = 18

export function ActivityHeatmap({ data, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // Use a deterministic date for SSR/hydration, then switch to the browser's
  // current date after mount so timezone boundaries cannot change the markup.
  const [today, setToday] = useState<Date | null>(null)
  const weekdays = getWeekdays()

  useEffect(() => {
    setToday(new Date())
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { weeks, monthLabels } = useMemo(() => {
    if (!today) return { weeks: [], monthLabels: [] }
    const effectiveToday = today ? new Date(today) : new Date(0)
    effectiveToday.setHours(0, 0, 0, 0)
    const currentMonday = getMonday(effectiveToday)

    const maxWeeks = Math.floor((containerWidth - LABEL_COL_WIDTH + GAP) / (CELL_SIZE + GAP))
    const weeksToShow = Math.max(4, Math.min(52, maxWeeks))

    const startDate = new Date(currentMonday)
    startDate.setDate(startDate.getDate() - (weeksToShow - 1) * 7)

    const countMap = new Map<string, number>()
    for (const entry of data) {
      countMap.set(entry.date, entry.count)
    }

    const weeks: Array<Array<{ date: string; count: number }>> = []
    const current = new Date(startDate)
    while (current <= effectiveToday) {
      const week: Array<{ date: string; count: number }> = []
      for (let day = 0; day < 7; day++) {
        const dateStr = formatDate(current)
        const isFuture = current > effectiveToday
        week.push({ date: dateStr, count: isFuture ? 0 : (countMap.get(dateStr) || 0) })
        current.setDate(current.getDate() + 1)
      }
      weeks.push(week)
    }

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
  }, [data, containerWidth, today])

  const numWeeks = weeks.length

  return (
    <div className="rounded-lg border border-border p-3">
      {numWeeks === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No data</div>
      ) : (
        <div ref={containerRef}>
          {/* Month labels */}
          <div className="relative h-4 text-[10px] text-muted-foreground mb-0.5" style={{ marginLeft: `${LABEL_COL_WIDTH}px` }}>
            {monthLabels.map(({ month, pct }) => (
              <span
                key={month}
                className="absolute top-0"
                style={{ left: `${pct}%` }}
              >
                <span suppressHydrationWarning>{new Date(2000, month - 1, 1).toLocaleString(undefined, { month: 'short' })}</span>
              </span>
            ))}
          </div>

          {/* Single grid: col 0 = weekday labels, col 1..N = weeks */}
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateRows: 'repeat(7, 1fr)',
              gridAutoFlow: 'column',
              gridTemplateColumns: `${LABEL_COL_WIDTH}px repeat(${numWeeks}, ${CELL_SIZE}px)`,
            }}
          >
            {/* Weekday labels in first column */}
            {weekdays.map((day, i) => (
              <div
                key={`${day}-${i}`}
                suppressHydrationWarning
                className="text-[10px] leading-none text-muted-foreground text-right pr-1"
                style={{
                  gridRow: i + 1,
                  gridColumn: 1,
                  height: `${CELL_SIZE}px`,
                  lineHeight: `${CELL_SIZE}px`,
                }}
              >
                {i % 2 === 0 ? day : ''}
              </div>
            ))}

            {/* Day cells */}
            {weeks.flatMap((week) =>
              week.map(({ date, count }) => {
                const level = getLevel(count)
                const isSelected = date === selectedDate
                return (
                  <div
                    key={date}
                    data-count={count}
                    data-level={level}
                    data-selected={isSelected ? 'true' : undefined}
                    title={`${count} events · ${date}`}
                    className="rounded-[2px] cursor-pointer transition-colors"
                    style={{
                      width: `${CELL_SIZE}px`,
                      height: `${CELL_SIZE}px`,
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
      )}
    </div>
  )
}
