import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { getStyleFromTemplate } from '@/lib/ai/style-helpers'
import { getAIStyle } from '@/lib/ai/styles'

// Mock dependencies
vi.mock('@/lib/ai/style-helpers', () => ({
  getStyleFromTemplate: vi.fn(),
}))

vi.mock('@/lib/ai/styles', () => ({
  getAIStyle: vi.fn(),
}))

vi.mock('@/lib/ai/openai', () => ({
  callOpenAI: vi.fn(),
}))

describe('/api/ai/polish-event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should reject empty event content', async () => {
      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventContent: '' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('事件内容不能为空')
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should reject missing event content', async () => {
      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('事件内容不能为空')
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should reject non-string event content', async () => {
      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventContent: 123 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('事件内容不能为空')
      expect(data.code).toBe('INVALID_INPUT')
    })
  })

  describe('Style Configuration', () => {
    it('should use style from template when templateId is provided', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Test prompt',
        temperature: 0.7,
        label: '测试风格',
      }
      ;(getStyleFromTemplate as any).mockResolvedValueOnce(mockStyleConfig)

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
          templateId: 1,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(getStyleFromTemplate).toHaveBeenCalledWith(1)
      expect(data.style).toBe('测试风格')
    })

    it('should use styleOverride when provided', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Technical prompt',
        temperature: 0.5,
        label: '技术研发',
      }
      ;(getAIStyle as any).mockReturnValue(mockStyleConfig)

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
          styleOverride: 'technical',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(getAIStyle).toHaveBeenCalledWith('technical')
      expect(data.style).toBe('技术研发')
    })

    it('should prioritize styleOverride over templateId', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Concise prompt',
        temperature: 0.3,
        label: '极简干练',
      }
      ;(getAIStyle as any).mockReturnValue(mockStyleConfig)

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
          templateId: 1,
          styleOverride: 'concise',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(getAIStyle).toHaveBeenCalledWith('concise')
      expect(getStyleFromTemplate).not.toHaveBeenCalled()
      expect(data.style).toBe('极简干练')
    })

    it('should use default style when no style is specified', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Default prompt',
        temperature: 0.8,
        label: '正式汇报',
      }
      ;(getAIStyle as any).mockReturnValue(mockStyleConfig)

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(getAIStyle).toHaveBeenCalledWith()
      expect(data.style).toBe('正式汇报')
    })
  })

  describe('Polish Operation', () => {
    it('should return polished content successfully', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Test prompt',
        temperature: 0.7,
        label: '测试风格',
      }
      ;(getAIStyle as any).mockReturnValue(mockStyleConfig)

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('polishedContent')
      expect(data).toHaveProperty('style')
      expect(data.message).toBe('事件润色成功')
    })

    it('should handle polish errors gracefully', async () => {
      const mockStyleConfig = {
        systemPrompt: 'Test prompt',
        temperature: 0.7,
        label: '测试风格',
      }
      ;(getAIStyle as any).mockReturnValue(mockStyleConfig)

      // The current implementation has a placeholder that always succeeds
      // In the future, when OpenAI integration is added, we should test error cases
      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.polishedContent).toContain('Test content')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON in request body', async () => {
      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('事件润色失败')
      expect(data.code).toBe('POLISH_ERROR')
    })

    it('should handle style fetch errors', async () => {
      ;(getStyleFromTemplate as any).mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/ai/polish-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventContent: 'Test content',
          templateId: 1,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('事件润色失败')
      expect(data.code).toBe('POLISH_ERROR')
    })
  })
})