import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimelineViewSwitcher } from './TimelineViewSwitcher'

const mockOnViewModeChange = vi.fn()

describe('TimelineViewSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render three view mode buttons', () => {
    render(<TimelineViewSwitcher viewMode="day" onViewModeChange={mockOnViewModeChange} />)
    
    expect(screen.getByRole('button', { name: '日' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '周' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '月' })).toBeInTheDocument()
  })

  it('should highlight active view mode', () => {
    render(<TimelineViewSwitcher viewMode="day" onViewModeChange={mockOnViewModeChange} />)
    
    const dayButton = screen.getByRole('button', { name: '日' })
    expect(dayButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should call onViewModeChange when clicking button', async () => {
    const user = userEvent.setup()
    render(<TimelineViewSwitcher viewMode="day" onViewModeChange={mockOnViewModeChange} />)
    
    const weekButton = screen.getByRole('button', { name: '周' })
    await user.click(weekButton)
    
    expect(mockOnViewModeChange).toHaveBeenCalledWith('week')
  })

  it('should update highlighted button on viewMode change', () => {
    const { rerender } = render(<TimelineViewSwitcher viewMode="day" onViewModeChange={mockOnViewModeChange} />)
    
    const dayButton = screen.getByRole('button', { name: '日' })
    expect(dayButton).toHaveAttribute('aria-pressed', 'true')
    
    rerender(<TimelineViewSwitcher viewMode="week" onViewModeChange={mockOnViewModeChange} />)
    
    const weekButton = screen.getByRole('button', { name: '周' })
    expect(weekButton).toHaveAttribute('aria-pressed', 'true')
    expect(dayButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('should support all three view modes', async () => {
    const user = userEvent.setup()
    render(<TimelineViewSwitcher viewMode="day" onViewModeChange={mockOnViewModeChange} />)
    
    await user.click(screen.getByRole('button', { name: '周' }))
    expect(mockOnViewModeChange).toHaveBeenCalledWith('week')
    
    await user.click(screen.getByRole('button', { name: '月' }))
    expect(mockOnViewModeChange).toHaveBeenCalledWith('month')
    
    await user.click(screen.getByRole('button', { name: '日' }))
    expect(mockOnViewModeChange).toHaveBeenCalledWith('day')
  })
})