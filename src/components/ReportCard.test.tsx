import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportCard } from './ReportCard'
import type { Report } from '@/lib/db/schema'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ReportCard', () => {
  const baseReport: Report = {
    id: 1,
    title: '测试周报',
    content: '周报内容',
    weekStart: '2024-01-08',
    weekEnd: '2024-01-14',
    aiStyleOverride: null,
    createdAt: new Date('2024-01-15T10:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00'),
  }

  it('should render title and week date range', () => {
    const onDelete = vi.fn()
    render(<ReportCard report={baseReport} onDelete={onDelete} />)

    expect(screen.getByText('测试周报')).toBeInTheDocument()
    expect(screen.getByText('01/08 - 01/14')).toBeInTheDocument()
  })

  it('should format different week ranges correctly', () => {
    const report: Report = {
      ...baseReport,
      id: 2,
      weekStart: '2024-12-30',
      weekEnd: '2025-01-05',
    }
    const onDelete = vi.fn()
    render(<ReportCard report={report} onDelete={onDelete} />)

    expect(screen.getByText('12/30 - 01/05')).toBeInTheDocument()
  })

  it('should call onDelete when delete button is clicked and confirmed', () => {
    const onDelete = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<ReportCard report={baseReport} onDelete={onDelete} />)

    const deleteButton = screen.getByRole('button', { name: /删除/i })
    fireEvent.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith(1)
  })

  it('should link to the report detail page', () => {
    const onDelete = vi.fn()
    render(<ReportCard report={baseReport} onDelete={onDelete} />)

    const links = screen.getAllByRole('link')
    const detailLink = links.find((l) => l.getAttribute('href') === '/reports/1')
    expect(detailLink).toBeDefined()
  })

  it('should have edit button linking to edit page', () => {
    const onDelete = vi.fn()
    render(<ReportCard report={baseReport} onDelete={onDelete} />)

    const links = screen.getAllByRole('link')
    const editLink = links.find((l) => l.getAttribute('href') === '/edit/1')
    expect(editLink).toBeDefined()
  })
})
