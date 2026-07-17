import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from './route'

const createMockChain = () => {
  const mockLimit = vi.fn()
  // orderBy() returns an object with limit(); limit() returns the final events
  const mockOrderByResult = { limit: mockLimit }
  const mockOrderBy = vi.fn().mockReturnValue(mockOrderByResult)
  const mockWhereResult = { orderBy: mockOrderBy, limit: mockLimit }
  const mockWhere = vi.fn().mockReturnValue(mockWhereResult)
  const mockDynamicResult = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }
  const mockDynamic = vi.fn().mockReturnValue(mockDynamicResult)
  const mockFromResult = { $dynamic: mockDynamic, where: mockWhere, orderBy: mockOrderBy, limit: mockLimit }
  const mockFrom = vi.fn().mockReturnValue(mockFromResult)
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
  const mockReturning = vi.fn()
  const mockValuesResult = { returning: mockReturning }
  const mockValues = vi.fn().mockReturnValue(mockValuesResult)
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues })
  const mockFindMany = vi.fn().mockResolvedValue([])
  const mockQuery = {
    collectSources: {
      findMany: mockFindMany,
    },
  }

  return {
    select: mockSelect,
    from: mockFrom,
    $dynamic: mockDynamic,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    query: mockQuery,
  }
}

let mockChain: ReturnType<typeof createMockChain> | null = null

vi.mock('@/lib/db', () => {
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
    if (tagNames.includes('成果') || tagNames.includes('achievement')) return 'achievement'
    if (tagNames.includes('风险') || tagNames.includes('risk')) return 'risk'
    if (tagNames.includes('计划') || tagNames.includes('plan')) return 'plan'
    return 'routine'
  }),
}))

describe('/api/events', () => {
  beforeEach(() => {
    // Reset chain so each test gets a fresh set of mocks
    mockChain = null
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
      db.limit.mockResolvedValueOnce(mockEvents)

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
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?weekStart=2024-01-08&weekEnd=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
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
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?tags=工作,会议')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })

    it('should handle database error', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockRejectedValueOnce(new Error('Database error'))

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
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?weekStart=2024-01-08&weekEnd=2024-01-14&status=processed&tags=工作')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })

    it('should filter events by date parameter', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'manual',
          content: 'Event on specific date',
          status: 'pending',
          tags: [],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?date=2024-01-10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
      expect(db.where).toHaveBeenCalled()
    })

    it('should combine date filter with other filters', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'manual',
          content: 'Filtered event on date',
          status: 'pending',
          tags: ['工作'],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?date=2024-01-10&source=manual&tags=工作')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })

    it('should ignore invalid date parameter', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2024-01-10T10:00:00'),
          source: 'manual',
          content: 'Event',
          status: 'pending',
          tags: [],
          isImportant: false,
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce(mockEvents)

      const request = new Request('http://localhost/api/events?date=invalid-date')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // Invalid date should not add a between condition, so only the default status filter applies
    })
  })

  describe('POST', () => {
    it('should create new memo event with tags', async () => {
      const mockEvent = {
        id: 1,
        content: '完成评审',
        tags: ['成果', '工作'],
        eventTime: new Date('2024-01-10T10:00:00'),
        source: 'manual',
        sectionType: 'achievement',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockEvent])

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '完成评审 #成果 #工作',
          eventTime: '2024-01-10T10:00:00',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.tags).toEqual(['成果', '工作'])
      expect(data.sectionType).toBe('achievement')
      expect(data.content).toBe('完成评审')
      expect(data.source).toBe('manual')
      expect(db.insert).toHaveBeenCalled()
      expect(db.values).toHaveBeenCalled()
    })

    it('should reject empty content', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject whitespace-only content', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '   ',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject missing content', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTime: '2024-01-10T10:00:00',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('内容不能为空')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject invalid eventTime format', async () => {
      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test event',
          eventTime: 'invalid-date',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('时间格式无效')
      expect(data.code).toBe('INVALID_EVENT_TIME')
    })

    it('should accept valid eventTime', async () => {
      const mockEvent = {
        id: 1,
        content: 'Test event',
        tags: [],
        eventTime: new Date('2024-01-15T14:30:00'),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date('2024-01-10T10:00:00'),
        updatedAt: new Date('2024-01-10T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockEvent])

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test event',
          eventTime: '2024-01-15T14:30:00',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(db.insert).toHaveBeenCalled()
    })

    it('should accept content without eventTime', async () => {
      const mockEvent = {
        id: 1,
        content: 'Test event',
        tags: [],
        eventTime: new Date(),
        source: 'manual',
        sectionType: 'routine',
        status: 'pending',
        isImportant: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.returning.mockResolvedValueOnce([mockEvent])

      const request = new Request('http://localhost/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Test event',
        }),
      })
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(db.insert).toHaveBeenCalled()
    })
  })
})