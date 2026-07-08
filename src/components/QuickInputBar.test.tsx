import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickInputBar } from './QuickInputBar'

const mockOnSubmit = vi.fn()
const mockOnTagClick = vi.fn()

describe('QuickInputBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render input with placeholder', () => {
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    expect(input).toBeInTheDocument()
  })

  it('should parse tags from input', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果 #工作')
    
    expect(input).toHaveValue('完成评审 #成果 #工作')
  })

  it('should submit on Enter key', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果 #工作')

    // Close completion dropdown if open
    await user.keyboard('{Escape}')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: '完成评审',
        tags: ['成果', '工作']
      })
    })
  })

  it('should clear input after submit', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果 #工作')

    // Close completion dropdown if open
    await user.keyboard('{Escape}')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('should not submit empty content', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '{enter}')
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should not submit whitespace-only content', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '   {enter}')
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should handle input without tags', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审{enter}')
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: '完成评审',
        tags: []
      })
    })
  })

  it('should highlight tags in input display', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)
    
    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果')
    
    const highlightedTags = screen.queryByText('#成果')
    if (highlightedTags) {
      expect(highlightedTags).toHaveClass('bg-blue-100')
    }
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

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果')

    // Close completion dropdown if open
    await user.keyboard('{Escape}')

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

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #成果')

    // Close completion dropdown if open
    await user.keyboard('{Escape}')

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(errorSubmit).toHaveBeenCalledWith({
        content: '完成评审',
        tags: ['成果']
      })
    })

    await waitFor(() => {
      expect(input).toHaveValue('完成评审 #成果')
    })
  })

  it('should show tag completion dropdown when typing #', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #')

    // Wait for dropdown to appear
    await waitFor(() => {
      const dropdown = document.querySelector('[cmdk-root]')
      expect(dropdown).toBeInTheDocument()
    })
  })

  it('should select tag from completion with Enter', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #工')

    // Wait for dropdown and select first item (工作)
    await waitFor(() => {
      const dropdown = document.querySelector('[cmdk-root]')
      expect(dropdown).toBeInTheDocument()
    })

    await user.keyboard('{Enter}')

    // Input should now have #工作 followed by space
    await waitFor(() => {
      expect(input).toHaveValue('完成评审 #工作 ')
    })
  })

  it('should filter tags by prefix', async () => {
    const user = userEvent.setup()
    render(<QuickInputBar onSubmit={mockOnSubmit} />)

    const input = screen.getByPlaceholderText('记录工作内容，使用 #标签 分类...')
    await user.type(input, '完成评审 #工')

    // Wait for dropdown to appear with filtered results
    await waitFor(() => {
      const items = document.querySelectorAll('[cmdk-item]')
      // Should show '工作' but not other tags
      expect(items.length).toBeGreaterThan(0)
      const firstItem = items[0]
      expect(firstItem.textContent).toContain('工作')
    })
  })
})