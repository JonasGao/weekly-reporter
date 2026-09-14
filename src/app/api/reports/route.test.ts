import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'

const mockDb = {
  query: {
    reports: {
      findMany: vi.fn(),
    },
  },
  select: vi.fn(),
  from: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => mockDb),
}))

describe('/api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up default chain: db.select().from()
    mockDb.select.mockReturnValue({ from: mockDb.from })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return reports with weekStart and weekEnd fields', async () => {
      const mockReports = [
        {
          id: 1,
          title: '2024年第2周工作周报',
          content: 'content-1',
          weekStart: '2024-01-08',
          weekEnd: '2024-01-14',
          createdAt: new Date('2024-01-15T10:00:00'),
          updatedAt: new Date('2024-01-15T10:00:00'),
        },
        {
          id: 2,
          title: '2024年第1周工作周报',
          content: 'content-2',
          weekStart: '2024-01-01',
          weekEnd: '2024-01-07',
          createdAt: new Date('2024-01-08T10:00:00'),
          updatedAt: new Date('2024-01-08T10:00:00'),
        },
      ]

      mockDb.query.reports.findMany.mockResolvedValueOnce(mockReports)
      mockDb.from.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/reports')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.reports).toHaveLength(2)
      expect(data.reports[0]).toMatchObject({
        id: 1,
        title: '2024年第2周工作周报',
        weekStart: '2024-01-08',
        weekEnd: '2024-01-14',
      })
      expect(data.reports[1]).toMatchObject({
        id: 2,
        title: '2024年第1周工作周报',
        weekStart: '2024-01-01',
        weekEnd: '2024-01-07',
      })
      expect(mockDb.query.reports.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      )
    })

    it('should support pagination', async () => {
      mockDb.query.reports.findMany.mockResolvedValueOnce([])
      mockDb.from.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/reports?page=2&pageSize=5')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.page).toBe(2)
      expect(data.pageSize).toBe(5)
      expect(mockDb.query.reports.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5,
        })
      )
    })

    it('should handle database errors', async () => {
      mockDb.query.reports.findMany.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/reports')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch reports')
      expect(data.code).toBe('FETCH_ERROR')
    })
  })
})
