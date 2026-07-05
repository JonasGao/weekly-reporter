import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from './route'

vi.mock('@/lib/db', () => {
  let mockChain: ReturnType<typeof createMockChain> | null = null
  
  const createMockChain = () => {
    const mockOrderBy = vi.fn()
    const mockFromResult = { orderBy: mockOrderBy }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
    const mockReturning = vi.fn()
    const mockValuesResult = { returning: mockReturning }
    const mockValues = vi.fn().mockReturnValue(mockValuesResult)
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues })

    return {
      select: mockSelect,
      from: mockFrom,
      orderBy: mockOrderBy,
      insert: mockInsert,
      values: mockValues,
      returning: mockReturning,
    }
  }

  return {
    getDb: vi.fn(() => {
      if (!mockChain) {
        mockChain = createMockChain()
      }
      return mockChain
    }),
  }
})

describe('/api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return all tags', async () => {
      const mockTags = [
        {
          id: 1,
          name: '工作',
          sectionType: 'routine',
          color: 'blue',
          isBuiltIn: false,
          createdAt: new Date('2024-01-10T10:00:00'),
          updatedAt: new Date('2024-01-10T10:00:00'),
        },
        {
          id: 2,
          name: '会议',
          sectionType: 'plan',
          color: 'green',
          isBuiltIn: false,
          createdAt: new Date('2024-01-10T10:00:00'),
          updatedAt: new Date('2024-01-10T10:00:00'),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockTags)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(2)
    })

    it('should handle database error', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockRejectedValueOnce(new Error('Database error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('获取标签列表失败')
      expect(data.code).toBe('FETCH_ERROR')
    })
  })

  describe('POST', () => {
    it('should create new tag', async () => {
      const mockTag = {
        id: 1,
        name: '新标签',
        sectionType: 'routine',
        color: 'cyan',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockTag])

      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新标签',
          sectionType: 'routine',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.name).toBe('新标签')
      expect(data.sectionType).toBe('routine')
      expect(data.color).toBe('cyan')
      expect(db.insert).toHaveBeenCalled()
      expect(db.values).toHaveBeenCalled()
    })

    it('should reject empty name', async () => {
      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          sectionType: 'routine',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('标签名称不能为空')
      expect(data.code).toBe('INVALID_NAME')
    })

    it('should reject whitespace-only name', async () => {
      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '   ',
          sectionType: 'routine',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('标签名称不能为空')
      expect(data.code).toBe('INVALID_NAME')
    })

    it('should reject missing name', async () => {
      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'routine',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('标签名称不能为空')
      expect(data.code).toBe('INVALID_NAME')
    })

    it('should reject invalid sectionType', async () => {
      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新标签',
          sectionType: 'invalid',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('无效的分类类型')
      expect(data.code).toBe('INVALID_SECTION_TYPE')
    })

    it('should accept valid sectionType values', async () => {
      const validTypes = ['achievement', 'risk', 'routine', 'plan']
      
      for (const sectionType of validTypes) {
        const mockTag = {
          id: 1,
          name: '新标签',
          sectionType,
          color: 'cyan',
          isBuiltIn: false,
          createdAt: new Date('2024-01-10T10:00:00'),
          updatedAt: new Date('2024-01-10T10:00:00'),
        }

        const { getDb } = await import('@/lib/db')
        const db = getDb()
        db.returning.mockResolvedValueOnce([mockTag])

        const request = new Request('http://localhost/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '新标签',
            sectionType,
            color: 'cyan',
          }),
        })
        const response = await POST(request)

        expect(response.status).toBe(201)
        expect(db.insert).toHaveBeenCalled()
      }
    })

    it('should accept tag without color', async () => {
      const mockTag = {
        id: 1,
        name: '新标签',
        sectionType: 'routine',
        color: null,
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockTag])

      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新标签',
          sectionType: 'routine',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(db.insert).toHaveBeenCalled()
    })

    it('should handle database error during insert', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新标签',
          sectionType: 'routine',
          color: 'cyan',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('创建标签失败')
      expect(data.code).toBe('CREATE_ERROR')
    })
  })
})