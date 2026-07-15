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
const CELL_SIZE = 10
const CELL_GAP = 2
const CELL_STEP = CELL_SIZE + CELL_GAP // 12px per cell

/** Split `total` items into at most `maxRows` rows, each at least `minPerRow` items. */
function computeRowSplits(total: number, maxRows: number, minPerRow: number): number[] {
  if (total === 0) return []
  // Find fewest rows where every row has >= minPerRow
  for (let rows = 1; rows <= maxRows; rows++) {
    const perRow = Math.ceil(total / rows)
    const lastRow = total - perRow * (rows - 1)
    if (lastRow >= minPerRow || rows === 1) {
      // Distribute evenly across `rows`
      const base = Math.floor(total / rows)
      const extra = total % rows
      const splits: number[] = []
      let offset = 0
      for (let i = 0; i < rows; i++) {
        const count = base + (i < extra ? 1 : 0)
        splits.push(offset + count)
        offset += count
      }
      return splits
    }
  }
  // Fallback: single row
  return [total]
}

export function ActivityHeatmap({ data, selectedDate, onDateSelect }: ActivityHeatmapProps) {
  const { weeks, rowBoundaries, monthLabelsPerRow } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentMonday = getMonday(today)

    // Go back ~52 weeks (364 days) from current Monday
    const startDate = new Date(currentMonday)
    startDate.setDate(startDate.getDate() - 52 * 7)

    // Build count map
    const countMap = new Map<string, number>()
    for (const entry of data) {
      countMap.set(entry.date, entry.count)
    }

    // Build weeks (columns), Mon-Sun
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

    // Split into rows: target max 4 rows, min 8 weeks per row
    const boundaries = computeRowSplits(weeks.length, 4, 8)

    // Month labels per row
    const labelsPerRow: Array<Array<{ month: number; col: number }>> = []
    let startIdx = 0
    for (const endIdx of boundaries) {
      const rowWeeks = weeks.slice(startIdx, endIdx)
      const labels: Array<{ month: number; col: number }> = []
      let lastMonth = -1
      rowWeeks.forEach((week, colIdx) => {
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
      labelsPerRow.push(labels)
      startIdx = endIdx
    }

    return { weeks, rowBoundaries: boundaries, monthLabelsPerRow: labelsPerRow }
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
        <div className="flex flex-col gap-[2px] text-[10px] text-muted-foreground pt-[18px] shrink-0">
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
        <div className="flex-1 min-w-0 space-y-1 overflow-x-auto">
          {weeks.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">暂无数据</div>
          ) : (
            monthLabelsPerRow.map((monthLabels, rowIdx) => {
              const startIdx = rowIdx === 0 ? 0 : rowBoundaries[rowIdx - 1]
              const endIdx = rowBoundaries[rowIdx]
              const rowWeeks = weeks.slice(startIdx, endIdx)

              return (
                <div key={rowIdx}>
                  {/* Month labels for this row */}
                  <div className="relative h-4 text-[10px] text-muted-foreground">
                    {monthLabels.map(({ month, col }) => (
                      <span
                        key={`${rowIdx}-${month}`}
                        className="absolute top-0"
                        style={{ left: `${col * CELL_STEP}px` }}
                      >
                        {month}月
                      </span>
                    ))}
                  </div>

                  {/* Weeks grid for this row */}
                  <div className="flex gap-[2px]">
                    {rowWeeks.map((week, weekIdx) => (
                      <div key={weekIdx} className="flex flex-col gap-[2px]">
                        {week.map(({ date, count }) => {
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
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
