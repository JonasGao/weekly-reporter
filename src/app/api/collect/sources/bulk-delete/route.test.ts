import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/db', () => {
  const mockReturning = vi.fn()
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning })
  const mockDelete = vi.fn().mockReturnValue({ where: mockWhere })

  return {
    getDb: vi.fn(() => ({
      delete: mockDelete,
      where: mockWhere,
      returning: mockReturning,
    })),
  }
})

describe('/api/collect/sources/bulk-delete', () => {
  const getMockDb = async () => {
    const { getDb } = await import('@/lib/db')
    return getDb() as unknown as {
      delete: ReturnType<typeof vi.fn>
      returning: ReturnType<typeof vi.fn>
    }
  }
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST', () => {
    it('should delete selected sources and return deletedCount', async () => {
      const deleted = [
        { id: 1, name: '源1' },
        { id: 2, name: '源2' },
        { id: 3, name: '源3' },
      ]

      const db = await getMockDb()
      db.returning.mockResolvedValueOnce(deleted)

      const request = new Request('http://localhost/api/collect/sources/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [1, 2, 3] }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedCount).toBe(3)
      expect(db.delete).toHaveBeenCalled()
    })

    it('should return 400 when ids is empty', async () => {
      const db = await getMockDb()

      const request = new Request('http://localhost/api/collect/sources/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('INVALID_IDS')
      expect(db.delete).not.toHaveBeenCalled()
    })

    it('should return 400 when ids is missing', async () => {
      const db = await getMockDb()

      const request = new Request('http://localhost/api/collect/sources/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('INVALID_IDS')
      expect(db.delete).not.toHaveBeenCalled()
    })
  })
})
