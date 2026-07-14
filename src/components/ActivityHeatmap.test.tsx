import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityHeatmap, type HeatmapData } from './ActivityHeatmap'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ActivityHeatmap', () => {
  const makeData = (entries: Array<[string, number]>): HeatmapData[] =>
    entries.map(([date, count]) => ({ date, count }))

  it('should render cells for each day in data', () => {
    const data = makeData([
      ['2026-07-14', 5],
      ['2026-07-13', 3],
    ])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate={null} onDateSelect={vi.fn()} />
    )

    // Should render at least 2 cells with data
    const cells = container.querySelectorAll('[data-count]')
    expect(cells.length).toBeGreaterThanOrEqual(2)
  })

  it('should show tooltip with count and date on hover', () => {
    const data = makeData([['2026-07-14', 5]])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate={null} onDateSelect={vi.fn()} />
    )

    const cell = container.querySelector('[data-count="5"]')
    expect(cell).toBeTruthy()
    // Check for title attribute (native tooltip)
    expect(cell?.getAttribute('title')).toContain('5')
    expect(cell?.getAttribute('title')).toContain('2026-07-14')
  })

  it('should call onDateSelect when a cell is clicked', () => {
    const onDateSelect = vi.fn()
    const data = makeData([['2026-07-14', 5]])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate={null} onDateSelect={onDateSelect} />
    )

    const cell = container.querySelector('[data-count="5"]')
    fireEvent.click(cell!)

    expect(onDateSelect).toHaveBeenCalledWith('2026-07-14')
  })

  it('should call onDateSelect(null) when clicking the already-selected date', () => {
    const onDateSelect = vi.fn()
    const data = makeData([['2026-07-14', 5]])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate="2026-07-14" onDateSelect={onDateSelect} />
    )

    const cell = container.querySelector('[data-count="5"]')
    fireEvent.click(cell!)

    expect(onDateSelect).toHaveBeenCalledWith(null)
  })

  it('should render empty heatmap when data is empty', () => {
    const { container } = render(
      <ActivityHeatmap data={[]} selectedDate={null} onDateSelect={vi.fn()} />
    )

    // Should still render the container (with empty grid)
    expect(container.firstChild).toBeTruthy()
  })

  it('should show month labels', () => {
    const data = makeData([
      ['2026-01-05', 1],
      ['2026-02-05', 1],
      ['2026-03-05', 1],
    ])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate={null} onDateSelect={vi.fn()} />
    )

    // Month labels should contain month numbers or Chinese characters
    const text = container.textContent || ''
    // At least some month indication should be present
    expect(text).toMatch(/\d+月|[1-9]/)
  })

  it('should highlight selected date', () => {
    const data = makeData([['2026-07-14', 5]])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate="2026-07-14" onDateSelect={vi.fn()} />
    )

    const cell = container.querySelector('[data-count="5"]')
    expect(cell?.getAttribute('data-selected')).toBe('true')
  })

  it('should assign correct color level based on count', () => {
    const data = makeData([
      ['2026-07-10', 0],  // level 0
      ['2026-07-11', 1],  // level 1
      ['2026-07-12', 4],  // level 2
      ['2026-07-13', 8],  // level 3
      ['2026-07-14', 15], // level 4
    ])

    const { container } = render(
      <ActivityHeatmap data={data} selectedDate={null} onDateSelect={vi.fn()} />
    )

    const levels = Array.from(container.querySelectorAll('[data-level]'))
      .map(el => el.getAttribute('data-level'))

    expect(levels).toContain('0')
    expect(levels).toContain('1')
    expect(levels).toContain('2')
    expect(levels).toContain('3')
    expect(levels).toContain('4')
  })
})
