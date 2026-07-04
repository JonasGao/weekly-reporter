import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from './route'

// Mock getDb with proper chainable query builder
vi.mock('@/lib/db', () => {
  const createMockChain = () => {
    const mockWhere = vi.fn()
    const mockFromResult = {
      where: mockWhere,
    }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({
      from: mockFrom,
    })
    
    const mockReturning = vi.fn()
    const mockValuesResult = {
      returning: mockReturning,
    }
    const mockValues = vi.fn().mockReturnValue(mockValuesResult)
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    })

    return {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
    }
  }

  return {
    getDb: vi.fn(() => createMockChain()),
  }
})

describe('/api/snippets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return all snippets when no category filter', async () => {
      const mockSnippets = [
        {
          id: 1,
          content: 'Snippet 1',
          category: '工作进展',
          isBuiltIn: true,
        },
        {
          id: 2,
          content: 'Snippet 2',
          category: '下周计划',
          isBuiltIn: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      // Mock the from() call to resolve with all snippets (no filtering)
      db.from.mockResolvedValueOnce(mockSnippets)

      const request = new Request('http://localhost/api/snippets')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.snippets).toHaveLength(2)
      expect(data.snippets[0].content).toBe('Snippet 1')
      expect(data.snippets[1].content).toBe('Snippet 2')
    })

    it('should filter snippets by category', async () => {
      const mockSnippets = [
        {
          id: 1,
          content: 'Snippet 1',
          category: '工作进展',
          isBuiltIn: true,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      
      // Mock the where clause for category filtering
      db.where.mockResolvedValueOnce(mockSnippets)

      const request = new Request('http://localhost/api/snippets?category=工作进展')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.snippets).toHaveLength(1)
      expect(data.snippets[0].category).toBe('工作进展')
    })

    it('should handle database error', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.from.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/snippets')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('获取句子片段失败')
      expect(data.code).toBe('FETCH_ERROR')
    })
  })

  describe('POST', () => {
    it('should create a new snippet successfully', async () => {
      const mockSnippet = {
        id: 1,
        content: 'New snippet',
        category: '通用',
        isBuiltIn: false,
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockSnippet])

      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New snippet' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.snippet.content).toBe('New snippet')
      expect(data.snippet.category).toBe('通用')
      expect(data.snippet.isBuiltIn).toBe(false)
    })

    it('should create snippet with custom category', async () => {
      const mockSnippet = {
        id: 1,
        content: 'New snippet',
        category: '工作进展',
        isBuiltIn: false,
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockSnippet])

      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New snippet', category: '工作进展' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.snippet.category).toBe('工作进展')
    })

    it('should reject empty content', async () => {
      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should reject content longer than 500 characters', async () => {
      const longContent = 'a'.repeat(501)

      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: longContent }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容长度不能超过500个字符')
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should reject invalid category type', async () => {
      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Valid content', category: 123 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('分类必须为字符串')
      expect(data.code).toBe('INVALID_INPUT')
    })

    it('should handle database error during creation', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Valid content' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('创建句子片段失败')
      expect(data.code).toBe('CREATE_ERROR')
    })

    it('should set isBuiltIn to false for user-created snippets', async () => {
      const mockSnippet = {
        id: 1,
        content: 'New snippet',
        category: '通用',
        isBuiltIn: false,
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockSnippet])

      const request = new Request('http://localhost/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'New snippet', isBuiltIn: true }), // Try to override
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.snippet.isBuiltIn).toBe(false)
    })
  })
})