import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/db', () => {
  let mockChain: ReturnType<typeof createMockChain> | null = null
  
  const createMockChain = () => {
    const mockOrderBy = vi.fn()
    const mockGroupByResult = { orderBy: mockOrderBy }
    const mockGroupBy = vi.fn().mockReturnValue(mockGroupByResult)
    const mockLeftJoinResult = { groupBy: mockGroupBy }
    const mockLeftJoin = vi.fn().mockReturnValue(mockLeftJoinResult)
    const mockFromResult = { leftJoin: mockLeftJoin }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
    
    return {
      select: mockSelect,
      from: mockFrom,
      leftJoin: mockLeftJoin,
      groupBy: mockGroupBy,
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

describe('/api/tags/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return tag statistics with usage counts', async () => {
      const mockStats = [
        { name: '工作', color: 'blue', usage_count: 15 },
        { name: '会议', color: 'green', usage_count: 8 },
        { name: '成果', color: 'cyan', usage_count: 3 },
        { name: '风险', color: 'red', usage_count: 0 },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockStats)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(4)
      expect(data[0]).toHaveProperty('name')
      expect(data[0]).toHaveProperty('color')
      expect(data[0]).toHaveProperty('usage_count')
    })

    it('should return tags ordered by usage count descending', async () => {
      const mockStats = [
        { name: '工作', color: 'blue', usage_count: 15 },
        { name: '会议', color: 'green', usage_count: 8 },
        { name: '成果', color: 'cyan', usage_count: 3 },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce(mockStats)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data[0].usage_count).toBeGreaterThanOrEqual(data[1].usage_count)
      expect(data[1].usage_count).toBeGreaterThanOrEqual(data[2].usage_count)
    })

    it('should handle database error', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockRejectedValueOnce(new Error('Database error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('获取标签统计失败')
      expect(data.code).toBe('FETCH_ERROR')
    })

    it('should return empty array when no tags exist', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb()
      db.orderBy.mockResolvedValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data).toHaveLength(0)
    })
  })
})