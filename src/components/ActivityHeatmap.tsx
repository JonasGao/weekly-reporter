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

const CELL_SIZE = 10
const GAP = 2
const LABEL_COL_WIDTH = 18

export function ActivityHeatmap({ data, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentMonday = getMonday(today)

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
    while (current <= today) {
      const week: Array<{ date: string; count: number }> = []
      for (let day = 0; day < 7; day++) {
        const dateStr = formatDate(current)
        const isFuture = current > today
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
  }, [data, containerWidth])

  const numWeeks = weeks.length

  return (
    <div className="rounded-lg border border-border p-3">
      {numWeeks === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">暂无数据</div>
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
                {month}月
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
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
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
                    title={`${count} 条事件 · ${date}`}
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
