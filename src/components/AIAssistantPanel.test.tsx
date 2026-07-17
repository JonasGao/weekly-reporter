import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AIAssistantPanel } from './AIAssistantPanel'
import type { AIStyle } from '@/lib/db/schema'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AIAssistantPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('Basic Rendering', () => {
    it('should render the panel with all operations', () => {
      render(<AIAssistantPanel reportId={1} />)

      expect(screen.getByText('选择事件')).toBeInTheDocument()
      expect(screen.getByText('润色文本')).toBeInTheDocument()
      expect(screen.getByText('扩展内容')).toBeInTheDocument()
      expect(screen.getByText('统一风格')).toBeInTheDocument()
    })

    it('should render textarea for event selection', () => {
      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      expect(textarea).toBeInTheDocument()
    })

    it('should render all operation buttons with descriptions', () => {
      render(<AIAssistantPanel reportId={1} />)

      expect(screen.getByText('优化表达，提升专业度')).toBeInTheDocument()
      expect(screen.getByText('补充细节，丰富描述')).toBeInTheDocument()
      expect(screen.getByText('整体调整，风格一致')).toBeInTheDocument()
    })
  })

  describe('Polish Operation', () => {
    it('should show error when polishing empty text', async () => {
      const { toast } = await import('sonner')
      render(<AIAssistantPanel reportId={1} />)

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      fireEvent.click(polishButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('请选择或输入要润色的文本')
      })
    })

    it('should call polish API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ polishedContent: 'Polished text' }),
      })

      render(<AIAssistantPanel reportId={1} templateId={2} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      fireEvent.click(polishButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/polish-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventContent: 'Test event',
            templateId: 2,
            styleOverride: undefined,
          }),
          signal: expect.any(Object),
        })
      })
    })

    it('should call polish API with styleOverride', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ polishedContent: 'Polished text' }),
      })

      render(
        <AIAssistantPanel
          reportId={1}
          styleOverride={"technical" as AIStyle}
        />
      )

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      fireEvent.click(polishButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/polish-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventContent: 'Test event',
            templateId: undefined,
            styleOverride: 'technical',
          }),
          signal: expect.any(Object),
        })
      })
    })

    it('should show success message after polishing', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ polishedContent: 'Polished text' }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      fireEvent.click(polishButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('润色成功！文本已优化')
      })
    })

    it('should handle polish API error', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API error' }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      fireEvent.click(polishButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Expand Operation', () => {
    it('should show error when expanding empty text', async () => {
      const { toast } = await import('sonner')
      render(<AIAssistantPanel reportId={1} />)

      const expandButton = screen.getByRole('button', { name: /扩展内容/i })
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('请选择或输入要扩展的文本')
      })
    })

    it('should call expand API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ expandedContent: 'Expanded text' }),
      })

      render(<AIAssistantPanel reportId={1} templateId={2} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const expandButton = screen.getByRole('button', { name: /扩展内容/i })
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/expand-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Test event',
            templateId: 2,
            styleOverride: undefined,
          }),
          signal: expect.any(Object),
        })
      })
    })

    it('should show success message after expanding', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ expandedContent: 'Expanded text' }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const expandButton = screen.getByRole('button', { name: /扩展内容/i })
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('扩展成功！内容已丰富')
      })
    })

    it('should handle expand API error', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API error' }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const expandButton = screen.getByRole('button', { name: /扩展内容/i })
      fireEvent.click(expandButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Unify Style Operation', () => {
    it('should call unify API with report ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<AIAssistantPanel reportId={1} templateId={2} />)

      const unifyButton = screen.getByRole('button', { name: /统一风格/i })
      fireEvent.click(unifyButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/ai/unify-style', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportId: 1,
            templateId: 2,
            styleOverride: undefined,
          }),
          signal: expect.any(Object),
        })
      })
    })

    it('should show success message after unifying', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const unifyButton = screen.getByRole('button', { name: /统一风格/i })
      fireEvent.click(unifyButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('风格统一成功！整体风格已调整')
      })
    })

    it('should handle unify API error', async () => {
      const { toast } = await import('sonner')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'API error' }),
      })

      render(<AIAssistantPanel reportId={1} />)

      const unifyButton = screen.getByRole('button', { name: /统一风格/i })
      fireEvent.click(unifyButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })
    })
  })

  describe('Loading State', () => {
    it('should disable all buttons while operation is in progress', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ polishedContent: 'Polished text' }),
        }), 100))
      )

      render(<AIAssistantPanel reportId={1} />)

      const textarea = screen.getByPlaceholderText(/在编辑器中选择文本/)
      fireEvent.change(textarea, { target: { value: 'Test event' } })

      const polishButton = screen.getByRole('button', { name: /润色文本/i })
      const expandButton = screen.getByRole('button', { name: /扩展内容/i })
      const unifyButton = screen.getByRole('button', { name: /统一风格/i })

      fireEvent.click(polishButton)

      // Wait a bit for the state to update
      await waitFor(() => {
        expect(polishButton).toBeDisabled()
        expect(expandButton).toBeDisabled()
        expect(unifyButton).toBeDisabled()
      })
    })
  })
})
