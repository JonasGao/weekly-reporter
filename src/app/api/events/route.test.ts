import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/db', () => {
  let mockChain: ReturnType<typeof createMockChain> | null = null
  
  const createMockChain = () => {
    const mockOrderBy = vi.fn()
    const mockWhereResult = { orderBy: mockOrderBy }
    const mockWhere = vi.fn().mockReturnValue(mockWhereResult)
    const mockFromResult = { where: mockWhere }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    return {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
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

describe('/api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return events ordered by eventTime descending', async () => {
      const mockEvents = [
        {
          id: 2,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'github',
          content: 'Later event',
          status: 'pending',
          tags: ['工作'],
          isImportant: false,
        },
        {
          id: 1,
          eventTime: new Date('2024-01-08T10:00:00'),
          source: 'manual',
          content: 'Earlier event',
          status: 'pending',
          tags: ['会议'],
          isImportant: true,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.events)).toBe(true)
      expect(data.events).toHaveLength(2)
    })

    it('should return events within date range', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'github',
          content: 'Event in range',
          status: 'pending',
          tags: [],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?weekStart=2024-01-08&weekEnd=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
      expect(db.where).toHaveBeenCalled()
    })

    it('should filter events by status', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'github',
          content: 'Processed event',
          status: 'processed',
          tags: [],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?status=processed')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(db.where).toHaveBeenCalled()
    })

    it('should default status to pending when not specified', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/events')
      await GET(request)

      expect(db.where).toHaveBeenCalled()
    })

    it('should filter events by tags', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'manual',
          content: 'Tagged event',
          status: 'pending',
          tags: ['工作', '会议'],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?tags=工作,会议')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })

    it('should handle database error', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/events')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('获取事件列表失败')
      expect(data.code).toBe('FETCH_ERROR')
    })

    it('should handle combined filters', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'github',
          content: 'Filtered event',
          status: 'processed',
          tags: ['工作'],
          isImportant: true,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?weekStart=2024-01-08&weekEnd=2024-01-14&status=processed&tags=工作')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })
  })
})