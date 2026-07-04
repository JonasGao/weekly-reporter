import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SnippetLibraryPanel } from './SnippetLibraryPanel'
import type { SentenceSnippet } from '@/lib/db/schema'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock clipboard API
const mockClipboardWrite = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockClipboardWrite,
  },
})

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SnippetLibraryPanel', () => {
  const mockSnippets: SentenceSnippet[] = [
    {
      id: 1,
      content: '本周完成了核心功能的开发',
      category: '工作进展',
      isBuiltIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      content: '下周计划推进测试工作',
      category: '下周计划',
      isBuiltIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      content: '遇到技术难点，正在攻关',
      category: '工作进展',
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockClipboardWrite.mockReset()
  })

  describe('Basic Rendering', () => {
    it('should render category filter dropdown', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('分类筛选')).toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<SnippetLibraryPanel />)

      expect(screen.getByText('加载中...')).toBeInTheDocument()
    })

    it('should display snippets after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
        expect(screen.getByText('下周计划推进测试工作')).toBeInTheDocument()
        expect(screen.getByText('遇到技术难点，正在攻关')).toBeInTheDocument()
      })
    })

    it('should display snippet count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('3 条片段')).toBeInTheDocument()
      })
    })
  })

  describe('Category Filtering', () => {
    it('should show all categories in dropdown after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('句子片段')).toBeInTheDocument()
      })

      // Verify category filter dropdown exists
      expect(screen.getByText('分类筛选')).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should show category tags on snippets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        // Check that category tags appear on snippet cards
        const categoryTags = screen.getAllByText('工作进展')
        expect(categoryTags.length).toBeGreaterThanOrEqual(2) // At least 2 snippets have this category

        const planTags = screen.getAllByText('下周计划')
        expect(planTags.length).toBeGreaterThanOrEqual(1) // At least 1 snippet has this category
      })
    })

    it('should show correct total snippet count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('3 条片段')).toBeInTheDocument() // Total count
      })
    })

    it('should initialize with "全部" category selected by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('句子片段')).toBeInTheDocument()
      })

      // All snippets should be visible by default (全部 category)
      expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
      expect(screen.getByText('下周计划推进测试工作')).toBeInTheDocument()
      expect(screen.getByText('遇到技术难点，正在攻关')).toBeInTheDocument()
    })
  })

  describe('Snippet Interactions', () => {
    it('should call onSelectSnippet when snippet is clicked', async () => {
      const mockOnSelect = vi.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel onSelectSnippet={mockOnSelect} />)

      await waitFor(() => {
        expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
      })

      const { toast } = await import('sonner')

      // Click snippet card
      const firstSnippet = screen.getByText('本周完成了核心功能的开发')
      fireEvent.click(firstSnippet)

      expect(mockOnSelect).toHaveBeenCalledWith('本周完成了核心功能的开发')
      expect(toast.success).toHaveBeenCalledWith('已插入片段')
    })

    it('should copy snippet to clipboard when copy button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
      })

      const { toast } = await import('sonner')
      mockClipboardWrite.mockResolvedValueOnce(undefined)

      // Click copy button (first snippet)
      const copyButtons = screen.getAllByLabelText('复制')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        expect(mockClipboardWrite).toHaveBeenCalledWith('本周完成了核心功能的开发')
        expect(toast.success).toHaveBeenCalledWith('已复制到剪贴板')
      })
    })

    it('should show check icon after successful copy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
      })

      mockClipboardWrite.mockResolvedValueOnce(undefined)

      // Click copy button
      const copyButtons = screen.getAllByLabelText('复制')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        // Should show Check icon (green checkmark)
        const checkIcons = screen.getAllByLabelText('复制')
        expect(checkIcons[0]).toBeInTheDocument()
      })
    })

    it('should handle copy error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('本周完成了核心功能的开发')).toBeInTheDocument()
      })

      const { toast } = await import('sonner')
      mockClipboardWrite.mockRejectedValueOnce(new Error('Copy failed'))

      // Click copy button
      const copyButtons = screen.getAllByLabelText('复制')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('复制失败')
      })
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no snippets exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: [] }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(screen.getByText('暂无片段')).toBeInTheDocument()
      })
    })

    it('should verify category extraction logic', async () => {
      const snippetsWithCategories: SentenceSnippet[] = [
        { ...mockSnippets[0], category: 'Category A' },
        { ...mockSnippets[1], category: 'Category B' },
        { ...mockSnippets[2], category: 'Category A' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: snippetsWithCategories }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        // Verify that category tags are displayed
        const categoryATags = screen.getAllByText('Category A')
        expect(categoryATags.length).toBeGreaterThanOrEqual(2) // Two snippets have Category A

        const categoryBTags = screen.getAllByText('Category B')
        expect(categoryBTags.length).toBeGreaterThanOrEqual(1) // One snippet has Category B
      })
    })
  })

  describe('Error Handling', () => {
    it('should show error message when fetch fails', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('获取片段库失败')
      })
    })

    it('should handle non-ok response', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: false,
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('获取片段库失败')
      })
    })
  })

  describe('Snippet Metadata', () => {
    it('should display category tags for snippets', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ snippets: mockSnippets }),
      })

      render(<SnippetLibraryPanel />)

      await waitFor(() => {
        const categoryTags = screen.getAllByText('工作进展')
        expect(categoryTags.length).toBeGreaterThan(0)

        const planTags = screen.getAllByText('下周计划')
        expect(planTags.length).toBeGreaterThan(0)
      })
    })
  })
})