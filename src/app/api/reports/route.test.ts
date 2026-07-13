import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/db', () => {
  const mockFindMany = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

  return {
    getDb: vi.fn(() => ({
      query: {
        reports: {
          findMany: mockFindMany,
        },
      },
      select: mockSelect,
    })),
    __mockFindMany: mockFindMany,
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
  }
})

describe('/api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      const { __mockFindMany, __mockFrom } = await import('@/lib/db')
      __mockFindMany.mockResolvedValueOnce(mockReports)
      __mockFrom.mockResolvedValueOnce(mockReports)

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
      expect(__mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 0,
        })
      )
    })

    it('should support pagination', async () => {
      const { __mockFindMany, __mockFrom } = await import('@/lib/db')
      __mockFindMany.mockResolvedValueOnce([])
      __mockFrom.mockResolvedValueOnce([])

      const request = new Request('http://localhost/api/reports?page=2&pageSize=5')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.page).toBe(2)
      expect(data.pageSize).toBe(5)
      expect(__mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5,
        })
      )
    })

    it('should handle database errors', async () => {
      const { __mockFindMany } = await import('@/lib/db')
      __mockFindMany.mockRejectedValueOnce(new Error('Database error'))

      const request = new Request('http://localhost/api/reports')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('获取周报列表失败')
      expect(data.code).toBe('FETCH_ERROR')
    })
  })
})
