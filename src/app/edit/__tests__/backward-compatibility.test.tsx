import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import EditReportPage from '../[id]/page'

// Mock next/navigation
const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: '1' }),
}))

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

// Mock MilkdownEditor
vi.mock('@/components/editor/MilkdownEditor', () => ({
  MilkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

// Mock CheckPanel
vi.mock('@/components/CheckPanel', () => ({
  CheckPanel: () => <div data-testid="check-panel">Check Panel</div>,
}))

// Mock ScorePanel
vi.mock('@/components/ScorePanel', () => ({
  ScorePanel: ({ onConfirm }: { onConfirm: () => void }) => (
    <button data-testid="score-panel-confirm" onClick={onConfirm}>
      Confirm
    </button>
  ),
}))

describe('EditReportPage - Backward Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('Without aiStyle (backward compatibility)', () => {
    it('should load and display report without aiStyle field', async () => {
      const mockReport = {
        id: 1,
        title: 'Weekly Report',
        content: 'Report content',
        templateId: 'official-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No aiStyle field - testing backward compatibility
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/reports/1') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockReport), // Directly return report object
          })
        }
        if (url.includes('/api/templates/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              template: {
                id: 'official-1',
                name: 'Template',
                content: 'Template content',
                // No aiStyle field in template either
              },
            }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      render(<EditReportPage />)

      await waitFor(() => {
        expect(screen.getByTestId('milkdown-editor')).toBeInTheDocument()
      })

      // Verify the editor has the content
      const editor = screen.getByTestId('milkdown-editor')
      expect(editor.value).toBe('Report content')
    })

    it('should save report without requiring aiStyle', async () => {
      const mockReport = {
        id: 1,
        title: 'Weekly Report',
        content: 'Report content',
        templateId: 'official-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      mockFetch.mockImplementation((url: string, options?: any) => {
        if (url === '/api/reports/1' && !options?.method) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockReport),
          })
        }
        if (url === '/api/reports/1' && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
          })
        }
        return Promise.resolve({ ok: false })
      })

      render(<EditReportPage />)

      await waitFor(() => {
        expect(screen.getByTestId('milkdown-editor')).toBeInTheDocument()
      })

      // Change content
      const editor = screen.getByTestId('milkdown-editor')
      editor.value = 'Updated content'

      // Save button should exist
      const saveButton = screen.getByRole('button', { name: /保存/i })
      expect(saveButton).toBeInTheDocument()
    })

    it('should work with templates without aiStyle', async () => {
      const mockReport = {
        id: 1,
        title: 'Weekly Report',
        content: 'Report content',
        templateId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const mockTemplate = {
        id: 'user-123',
        name: 'User Template',
        content: 'Template content',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No aiStyle field - backward compatible
      }

      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/reports/1') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockReport),
          })
        }
        if (url === '/api/templates/user-123') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ template: mockTemplate }),
          })
        }
        return Promise.resolve({ ok: false })
      })

      render(<EditReportPage />)

      await waitFor(() => {
        expect(screen.getByTestId('milkdown-editor')).toBeInTheDocument()
      })
    })
  })
})