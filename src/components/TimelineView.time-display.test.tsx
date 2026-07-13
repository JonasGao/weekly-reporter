import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimelineView } from './TimelineView'
import type { RawEvent } from '@/lib/db/schema'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('TimelineView 时间显示集成', () => {
  const makeEvent = (id: number, eventTime: Date): RawEvent =>
    ({
      id,
      content: `事件 ${id}`,
      source: 'manual',
      eventTime,
      isImportant: false,
      tags: null,
      metadata: null,
      createdAt: new Date('2026-07-13T10:00:00'),
    }) as unknown as RawEvent

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T14:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应根据时间间隔混合显示相对时间和具体时间', () => {
    const events = [
      makeEvent(1, new Date('2026-07-13T13:30:00')), // 30 分钟前
      makeEvent(2, new Date('2026-07-13T12:00:00')), // 正好 2 小时前
      makeEvent(3, new Date('2026-07-13T10:00:00')), // 4 小时前
      makeEvent(4, new Date('2026-07-12T09:00:00')), // 昨天
    ]

    render(<TimelineView events={events} />)

    // 30 分钟前 - 相对时间
    expect(screen.getByText(/30 分钟前/)).toBeInTheDocument()

    // 正好 2 小时 - 相对时间
    expect(screen.getByText(/2 小时前/)).toBeInTheDocument()

    // 4 小时前 - 具体时间
    expect(screen.getByText('2026-07-13 10:00')).toBeInTheDocument()

    // 昨天 - 具体时间
    expect(screen.getByText('2026-07-12 09:00')).toBeInTheDocument()
  })
})
