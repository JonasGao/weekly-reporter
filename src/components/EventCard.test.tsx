import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventCard } from './EventCard'
import type { RawEvent } from '@/lib/db/schema'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('EventCard', () => {
  const makeEvent = (eventTime: Date): RawEvent =>
    ({
      id: 1,
      content: '测试事件',
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

  describe('时间显示', () => {
    it('应在 2 小时内显示相对时间', () => {
      const event = makeEvent(new Date('2026-07-13T13:00:00'))
      render(<EventCard event={event} />)
      // 大约 1 小时前
      expect(screen.getByText(/1 小时前/)).toBeInTheDocument()
    })

    it('应在几分钟内显示分钟级相对时间', () => {
      const event = makeEvent(new Date('2026-07-13T13:55:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/5 分钟前/)).toBeInTheDocument()
    })

    it('应在正好 2 小时时仍显示相对时间', () => {
      const event = makeEvent(new Date('2026-07-13T12:00:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/2 小时前/)).toBeInTheDocument()
    })

    it('应在超过 2 小时后显示具体日期时间', () => {
      const event = makeEvent(new Date('2026-07-13T11:30:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText('2026-07-13 11:30')).toBeInTheDocument()
    })

    it('应正确格式化前一天超过 2 小时的事件', () => {
      const event = makeEvent(new Date('2026-07-12T09:15:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText('2026-07-12 09:15')).toBeInTheDocument()
    })
  })
})
