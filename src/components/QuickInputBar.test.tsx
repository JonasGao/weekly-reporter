import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickInputBar } from './QuickInputBar'

const mockOnSubmit = vi.fn()

describe('QuickInputBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render input with placeholder', () => {
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    expect(input).toBeInTheDocument()
  })

  it('should submit on Enter key', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '完成评审')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: '完成评审',
      })
    })
  })

  it('should clear input after submit', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '完成评审')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('should not submit empty content', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '{enter}')

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should not submit whitespace-only content', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '   {enter}')

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should support custom placeholder', () => {
    render(<QuickInputBar onSubmit={mockOnSubmit} placeholder="自定义占位符" />)

    const input = screen.getByPlaceholderText('自定义占位符')
    expect(input).toBeInTheDocument()
  })

  it('should show loading state during submit', async () => {
    const slowSubmit = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={slowSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '完成评审')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(input).toBeDisabled()
    })

    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })
  })

  it('should handle submit error gracefully', async () => {
    const errorSubmit = vi.fn().mockRejectedValue(new Error('Submit failed'))
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={errorSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容...')
    await user.type(input, '完成评审')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(errorSubmit).toHaveBeenCalledWith({
        content: '完成评审',
      })
    })

    await waitFor(() => {
      expect(input).toHaveValue('完成评审')
    })
  })
})
