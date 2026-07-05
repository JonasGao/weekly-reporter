import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PUT, DELETE } from './route'

vi.mock('@/lib/db', () => {
  let mockChain: ReturnType<typeof createMockChain> | null = null
  
  const createMockChain = () => {
    const mockOrderBy = vi.fn()
    const mockLimit = vi.fn()
    const mockWhereResult = { orderBy: mockOrderBy, limit: mockLimit }
    const mockWhere = vi.fn().mockReturnValue(mockWhereResult)
    const mockFromResult = { where: mockWhere }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
    const mockReturningDelete = vi.fn()
    const mockWhereDelete = vi.fn().mockReturnValue({ returning: mockReturningDelete })
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete })
    const mockReturningUpdate = vi.fn()
    const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturningUpdate })
    const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate })
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

    return {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      update: mockUpdate,
      set: mockSet,
      delete: mockDelete,
      returning: mockReturningUpdate,
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

describe('/api/tags/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PUT', () => {
    it('should update tag name and color', async () => {
      const existingTag = {
        id: 1,
        name: '旧标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const updatedTag = {
        ...existingTag,
        name: '新标签',
        color: 'green',
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])
      db.returning.mockResolvedValueOnce([updatedTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新标签',
          color: 'green',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('新标签')
      expect(data.color).toBe('green')
      expect(db.update).toHaveBeenCalled()
      expect(db.set).toHaveBeenCalled()
    })

    it('should update tag sectionType', async () => {
      const existingTag = {
        id: 1,
        name: '标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const updatedTag = {
        ...existingTag,
        sectionType: 'achievement',
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])
      db.returning.mockResolvedValueOnce([updatedTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'achievement',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })

      expect(response.status).toBe(200)
      expect(db.set).toHaveBeenCalled()
    })

    it('should return 404 for non-existent tag', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/tags/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      })
      const params = { id: '999' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tag not found')
    })

    it('should reject empty name', async () => {
      const existingTag = {
        id: 1,
        name: '旧标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('标签名称不能为空')
      expect(data.code).toBe('INVALID_NAME')
    })

    it('should reject whitespace-only name', async () => {
      const existingTag = {
        id: 1,
        name: '旧标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '   ',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('标签名称不能为空')
      expect(data.code).toBe('INVALID_NAME')
    })

    it('should reject invalid sectionType', async () => {
      const existingTag = {
        id: 1,
        name: '标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'invalid',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('无效的分类类型')
      expect(data.code).toBe('INVALID_SECTION_TYPE')
    })

    it('should reject invalid request body', async () => {
      const existingTag = {
        id: 1,
        name: '标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('请求体格式无效')
      expect(data.code).toBe('INVALID_BODY')
    })
  })

  describe('DELETE', () => {
    it('should delete non-built-in tag', async () => {
      const existingTag = {
        id: 1,
        name: '可删除标签',
        sectionType: 'routine',
        color: 'blue',
        isBuiltIn: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])
      db.returning.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'DELETE',
      })
      const params = { id: '1' }
      const response = await DELETE(request, { params })

      expect(response.status).toBe(204)
      expect(db.delete).toHaveBeenCalled()
    })

    it('should reject deletion of built-in tag', async () => {
      const existingTag = {
        id: 1,
        name: '内置标签',
        sectionType: 'achievement',
        color: 'cyan',
        isBuiltIn: true,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingTag])

      const request = new Request('http://localhost/api/tags/1', {
        method: 'DELETE',
      })
      const params = { id: '1' }
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot delete built-in tag')
    })

    it('should return 404 for non-existent tag', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/tags/999', {
        method: 'DELETE',
      })
      const params = { id: '999' }
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tag not found')
    })
  })
})