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

vi.mock('@/lib/tags/parser', () => ({
  parseTags: vi.fn((input: string) => {
    const tags: string[] = []
    const content = input.replace(/#([\w\u4e00-\u9fa5]+)/g, (match, tag) => {
      tags.push(tag)
      return ''
    }).replace(/\s+/g, ' ').trim()
    return { content, tags }
  }),
}))

vi.mock('@/lib/tags/mapper', () => ({
  mapTagsToSectionType: vi.fn(async (tagNames: string[]) => {
    if (tagNames.includes('会议') || tagNames.includes('plan')) return 'plan'
    return 'routine'
  }),
}))

describe('/api/events/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PUT', () => {
    it('should update event content and tags', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const updatedEvent = {
        ...existingEvent,
        content: '更新后的内容',
        tags: ['会议'],
        isImportant: true,
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])
      db.returning.mockResolvedValueOnce([updatedEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '更新后的内容 #会议',
          isImportant: true,
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('更新后的内容')
      expect(data.tags).toEqual(['会议'])
      expect(data.isImportant).toBe(true)
      expect(db.update).toHaveBeenCalled()
      expect(db.set).toHaveBeenCalled()
    })

    it('should update event time', async () => {
      const existingEvent = {
        id: 1,
        content: 'Test event',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const updatedEvent = {
        ...existingEvent,
        eventTime: new Date('2024-01-15T10:00:00'),
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])
      db.returning.mockResolvedValueOnce([updatedEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTime: '2024-01-15T10:00:00',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })

      expect(response.status).toBe(200)
      expect(db.set).toHaveBeenCalled()
    })

    it('should return 404 for non-existent event', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/events/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test' }),
      })
      const params = { id: '999' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })

    it('should reject empty content', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject whitespace-only content', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '   ',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject invalid eventTime format', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTime: 'invalid-date',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('时间格式无效')
      expect(data.code).toBe('INVALID_EVENT_TIME')
    })

    it('should reject non-boolean isImportant', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isImportant: 'yes',
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('isImportant 必须是布尔值')
      expect(data.code).toBe('INVALID_IS_IMPORTANT')
    })

    it('should reject invalid request body', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
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

    it('should accept boolean false for isImportant', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: true,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const updatedEvent = {
        ...existingEvent,
        isImportant: false,
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])
      db.returning.mockResolvedValueOnce([updatedEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isImportant: false,
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })

      expect(response.status).toBe(200)
      expect(db.set).toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it('should delete manual event', async () => {
      const existingEvent = {
        id: 1,
        content: 'Test event',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])
      db.returning.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'DELETE',
      })
      const params = { id: '1' }
      const response = await DELETE(request, { params })

      expect(response.status).toBe(204)
      expect(db.delete).toHaveBeenCalled()
    })

    it('should reject deletion of non-manual event', async () => {
      const existingEvent = {
        id: 1,
        content: 'GitHub event',
        tags: [],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'github',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])

      const request = new Request('http://localhost/api/events/1', {
        method: 'DELETE',
      })
      const params = { id: '1' }
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Cannot delete non-manual event')
    })

    it('should return 404 for non-existent event', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/events/999', {
        method: 'DELETE',
      })
      const params = { id: '999' }
      const response = await DELETE(request, { params })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Event not found')
    })
  })
})