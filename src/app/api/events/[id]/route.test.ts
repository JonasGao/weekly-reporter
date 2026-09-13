import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PUT, DELETE } from './route'
import { syncEventTags } from '@/lib/tags'

vi.mock('@/lib/tags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags')>()
  return { ...actual, syncEventTags: vi.fn() }
})

const createMockChain = () => {
  const mockOrderBy = vi.fn()
  const mockLimit = vi.fn()
  const mockWhereResult = { orderBy: mockOrderBy, limit: mockLimit }
  const mockWhere = vi.fn().mockReturnValue(mockWhereResult)
  const mockFromResult = { where: mockWhere }
  const mockFrom = vi.fn().mockReturnValue(mockFromResult)
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

  // For DELETE: tx.delete(...).where(...).run()
  const mockRun = vi.fn()
  const mockWhereDelete = vi.fn().mockReturnValue({ run: mockRun })
  const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete })

  // For PUT: tx.update(...).set(...).where(...).returning().get()
  const mockGetUpdate = vi.fn()
  const mockReturningUpdate = vi.fn().mockReturnValue({ get: mockGetUpdate })
  const mockWhereUpdate = vi.fn().mockReturnValue({ returning: mockReturningUpdate })
  const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate })
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet })

  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
    delete: mockDelete,
    returning: mockReturningUpdate,
    get: mockGetUpdate,
    run: mockRun,
    transaction: null as unknown as ReturnType<typeof vi.fn>,
  }
  chain.transaction = vi.fn((cb: (tx: typeof chain) => unknown) => cb(chain))
  return chain
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

describe('/api/events/[id]', () => {
  beforeEach(() => {
    mockChain = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('PUT', () => {
    it('should update event content and sync tags', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
        content: '更新后的内容 #成果',
        isImportant: true,
        updatedAt: new Date('2024-01-11T10:00:00'),
      }

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.limit.mockResolvedValueOnce([existingEvent])
      db.get.mockReturnValueOnce(updatedEvent)

      const request = new Request('http://localhost/api/events/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '更新后的内容 #成果',
          isImportant: true,
        }),
      })
      const params = { id: '1' }
      const response = await PUT(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBe('更新后的内容 #成果')
      expect(data.isImportant).toBe(true)
      expect(db.update).toHaveBeenCalled()
      expect(db.set).toHaveBeenCalled()
      expect(db.transaction).toHaveBeenCalled()
      expect(syncEventTags).toHaveBeenCalledWith(expect.anything(), 1, ['成果'])
    })

    it('should update event time without syncing tags (no content change)', async () => {
      const existingEvent = {
        id: 1,
        content: 'Test event',
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
      db.get.mockReturnValueOnce(updatedEvent)

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
      expect(syncEventTags).not.toHaveBeenCalled()
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
      expect(data.error).toBe('Content is required')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject whitespace-only content', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
      expect(data.error).toBe('Content is required')
      expect(data.code).toBe('INVALID_CONTENT')
    })

    it('should reject invalid eventTime format', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
      expect(data.error).toBe('Invalid event time')
      expect(data.code).toBe('INVALID_EVENT_TIME')
    })

    it('should reject non-boolean isImportant', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
      expect(data.error).toBe('isImportant must be a boolean')
      expect(data.code).toBe('INVALID_IS_IMPORTANT')
    })

    it('should reject invalid request body', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
      expect(data.error).toBe('Invalid request body')
      expect(data.code).toBe('INVALID_BODY')
    })

    it('should accept boolean false for isImportant without syncing tags', async () => {
      const existingEvent = {
        id: 1,
        content: 'Original content',
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
      db.get.mockReturnValueOnce(updatedEvent)

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
      expect(syncEventTags).not.toHaveBeenCalled()
    })
  })

  describe('DELETE', () => {
    it('should delete manual event with tag cascade', async () => {
      const existingEvent = {
        id: 1,
        content: 'Test event',
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
        method: 'DELETE',
      })
      const params = { id: '1' }
      const response = await DELETE(request, { params })

      expect(response.status).toBe(204)
      expect(db.transaction).toHaveBeenCalled()
      // delete().where().run() called twice: eventTags + rawEvents
      expect(db.delete).toHaveBeenCalledTimes(2)
      expect(db.run).toHaveBeenCalledTimes(2)
    })

    it('should reject deletion of non-manual event', async () => {
      const existingEvent = {
        id: 1,
        content: 'GitHub event',
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
