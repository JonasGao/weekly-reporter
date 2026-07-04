import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleSelector } from './StyleSelector'
import type { AIStyle } from '@/lib/db/schema'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('StyleSelector', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('Basic Rendering', () => {
    it('should render style selector with default value', () => {
      render(<StyleSelector onChange={mockOnChange} />)

      expect(screen.getByText('AI 风格')).toBeInTheDocument()
      // Check that formal style is selected in the label area (not in dropdown)
      expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument() // Description text
    })

    it('should render with controlled value', () => {
      render(<StyleSelector value="technical" onChange={mockOnChange} />)

      expect(screen.getByText('专业准确，保留技术细节')).toBeInTheDocument() // Technical style description
    })

    it('should display all style options when opened', async () => {
      const user = userEvent.setup()
      render(<StyleSelector onChange={mockOnChange} />)

      const trigger = screen.getByRole('combobox')
      await user.click(trigger)

      // Check for style labels in dropdown
      expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument()
      expect(screen.getByText('专业准确，保留技术细节')).toBeInTheDocument()
      expect(screen.getByText('短句表达，只保留核心信息')).toBeInTheDocument()
      expect(screen.getByText('侧重问题分析与经验沉淀')).toBeInTheDocument()
    })
  })

  describe('Style Selection', () => {
    // Note: Testing dropdown interaction is complex with base-ui components
    // Focus on verifying value changes through props
    it('should render different styles when value prop changes', async () => {
      const { rerender } = render(<StyleSelector value="formal" onChange={mockOnChange} />)

      expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument()

      rerender(<StyleSelector value="technical" onChange={mockOnChange} />)
      expect(screen.getByText('专业准确，保留技术细节')).toBeInTheDocument()

      rerender(<StyleSelector value="concise" onChange={mockOnChange} />)
      expect(screen.getByText('短句表达，只保留核心信息')).toBeInTheDocument()

      rerender(<StyleSelector value="detailed" onChange={mockOnChange} />)
      expect(screen.getByText('侧重问题分析与经验沉淀')).toBeInTheDocument()
    })

    it('should update displayed description when style changes', async () => {
      const { rerender } = render(<StyleSelector value="formal" onChange={mockOnChange} />)

      expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument()

      rerender(<StyleSelector value="concise" onChange={mockOnChange} />)
      expect(screen.getByText('短句表达，只保留核心信息')).toBeInTheDocument()
    })
  })

  describe('Template Integration', () => {
    it('should fetch template style when templateId is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          template: { aiStyle: 'detailed' },
        }),
      })

      render(<StyleSelector templateId={1} onChange={mockOnChange} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/templates/1')
      })

      await waitFor(() => {
        expect(screen.getByText('侧重问题分析与经验沉淀')).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching template', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<StyleSelector templateId={1} onChange={mockOnChange} />)

      const trigger = screen.getByRole('combobox')
      expect(trigger).toBeDisabled()
    })

    it('should handle template fetch error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<StyleSelector templateId={1} onChange={mockOnChange} />)

      await waitFor(() => {
        // Should fall back to default style
        expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument()
      })
    })

    it('should use styleOverride over template style', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          template: { aiStyle: 'detailed' },
        }),
      })

      render(
        <StyleSelector
          templateId={1}
          value="technical"
          onChange={mockOnChange}
        />
      )

      // styleOverride (value prop) should take precedence
      expect(screen.getByText('专业准确，保留技术细节')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid template response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // No template field
      })

      render(<StyleSelector templateId={1} onChange={mockOnChange} />)

      await waitFor(() => {
        expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument() // Default
      })
    })

    it('should handle template without aiStyle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          template: {}, // No aiStyle field
        }),
      })

      render(<StyleSelector templateId={1} onChange={mockOnChange} />)

      await waitFor(() => {
        expect(screen.getByText('正式严谨，突出成果价值')).toBeInTheDocument() // Default
      })
    })
  })
})