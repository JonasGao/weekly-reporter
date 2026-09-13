import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventCard } from './EventCard'
import type { RawEvent } from '@/lib/db/schema'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('EventCard', () => {
  const makeEvent = (
    eventTime: Date | string | number,
    overrides: Partial<RawEvent> = {}
  ): RawEvent =>
    ({
      id: 1,
      content: '测试事件',
      source: 'manual',
      eventTime: eventTime as Date,
      isImportant: false,
      metadata: null,
      createdAt: new Date('2026-07-13T10:00:00'),
      updatedAt: new Date('2026-07-13T10:00:00'),
      ...overrides,
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
      // 大约 1 小时前 (or "1 hour ago" in English locale)
      expect(screen.getByText(/1.*(小时前|hour ago)/)).toBeInTheDocument()
    })

    it('应在几分钟内显示分钟级相对时间', () => {
      const event = makeEvent(new Date('2026-07-13T13:55:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/5.*(分钟前|minutes ago)/)).toBeInTheDocument()
    })

    it('应在正好 2 小时时仍显示相对时间', () => {
      const event = makeEvent(new Date('2026-07-13T12:00:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/2.*(小时前|hours ago)/)).toBeInTheDocument()
    })

    it('应在超过 2 小时后显示具体日期时间', () => {
      const event = makeEvent(new Date('2026-07-13T11:30:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/2026.*11:30/)).toBeInTheDocument()
    })

    it('应正确格式化前一天超过 2 小时的事件', () => {
      const event = makeEvent(new Date('2026-07-12T09:15:00'))
      render(<EventCard event={event} />)
      expect(screen.getByText(/Jul.*12.*9:15|2026.*09:15/)).toBeInTheDocument()
    })

    it('应支持 ISO 8601 字符串输入', () => {
      const isoString = new Date('2026-07-13T13:30:00').toISOString()
      const event = makeEvent(isoString)
      render(<EventCard event={event} />)
      expect(screen.getByText(/30.*(分钟前|minutes ago)/)).toBeInTheDocument()
    })

    it('应支持时间戳数字输入', () => {
      const timestamp = new Date('2026-07-13T10:00:00').getTime()
      const event = makeEvent(timestamp)
      render(<EventCard event={event} />)
      expect(screen.getByText(/2026.*10:00/)).toBeInTheDocument()
    })
  })

  describe('时间详情提示', () => {
    it('git 事件 ≤2h：弹层包含 Authored 和 Synced 行', async () => {
      const event = makeEvent(new Date('2026-07-13T13:00:00'), {
        source: 'git',
        createdAt: new Date('2026-07-13T13:30:00'),
        updatedAt: new Date('2026-07-13T13:30:00'),
      })
      render(<EventCard event={event} />)
      const trigger = screen.getByRole('button', { name: /1.*(小时前|hour ago)/ })
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText(/Authored:/)).toBeInTheDocument()
      expect(screen.getByText(/Synced:/)).toBeInTheDocument()
    })

    it('git 事件 >2h：卡片显示绝对时间，弹层只有 Synced，无 Authored', async () => {
      const event = makeEvent(new Date('2026-07-13T11:30:00'), {
        source: 'git',
        createdAt: new Date('2026-07-13T12:00:00'),
        updatedAt: new Date('2026-07-13T12:00:00'),
      })
      render(<EventCard event={event} />)
      // Card shows absolute time
      expect(screen.getByText(/2026.*11:30/)).toBeInTheDocument()
      const trigger = screen.getByRole('button', { name: /2026.*11:30/ })
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText(/Synced:/)).toBeInTheDocument()
      expect(screen.queryByText(/Authored:/)).not.toBeInTheDocument()
    })

    it('手动 ≤2h，无回填无修改：弹层只有裸 eventTime', async () => {
      const event = makeEvent(new Date('2026-07-13T13:00:00'), {
        source: 'manual',
        createdAt: new Date('2026-07-13T13:00:00'),
        updatedAt: new Date('2026-07-13T13:00:00'),
      })
      render(<EventCard event={event} />)
      const trigger = screen.getByRole('button', { name: /1.*(小时前|hour ago)/ })
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText(/Jul.*13.*1:00 PM|2026.*13:00/)).toBeInTheDocument()
      expect(screen.queryByText(/Recorded:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Updated:/)).not.toBeInTheDocument()
    })

    it('手动 ≤2h 且 backdated：出现 Recorded', async () => {
      const event = makeEvent(new Date('2026-07-13T13:00:00'), {
        source: 'manual',
        createdAt: new Date('2026-07-13T13:05:00'), // 5 min later, >60s diff
        updatedAt: new Date('2026-07-13T13:05:00'),
      })
      render(<EventCard event={event} />)
      const trigger = screen.getByRole('button', { name: /1.*(小时前|hour ago)/ })
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText(/Recorded:/)).toBeInTheDocument()
    })

    it('手动 modified：出现 Updated', async () => {
      const event = makeEvent(new Date('2026-07-13T13:00:00'), {
        source: 'manual',
        createdAt: new Date('2026-07-13T13:00:00'),
        updatedAt: new Date('2026-07-13T13:10:00'), // > createdAt
      })
      render(<EventCard event={event} />)
      const trigger = screen.getByRole('button', { name: /1.*(小时前|hour ago)/ })
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getByText(/Updated:/)).toBeInTheDocument()
    })

    it('手动 >2h 且无增量：弹层不出现', async () => {
      const event = makeEvent(new Date('2026-07-13T11:00:00'), {
        source: 'manual',
        createdAt: new Date('2026-07-13T11:00:00'),
        updatedAt: new Date('2026-07-13T11:00:00'),
      })
      render(<EventCard event={event} />)
      // Button still exists with absolute time
      const trigger = screen.getByRole('button', { name: /2026.*11:00/ })
      expect(trigger).toBeInTheDocument()
      trigger.focus()
      await vi.advanceTimersByTimeAsync(0)
      // Tooltip should not appear (disabled)
      expect(screen.queryByText(/Recorded:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Updated:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Authored:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Synced:/)).not.toBeInTheDocument()
    })
  })
})
