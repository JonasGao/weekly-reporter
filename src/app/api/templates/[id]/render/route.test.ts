import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from './route'

vi.mock('@/lib/db', () => {
  let mockChain: ReturnType<typeof createMockChain> | null = null

  const createMockChain = () => {
    const mockOrderBy = vi.fn()
    const mockLimit = vi.fn()
    // where() returns a thenable that resolves to the events array
    // This simulates drizzle's behavior where the query builder is thenable
    const mockWhereResult: any = {
      orderBy: mockOrderBy,
      limit: mockLimit,
      then: vi.fn(),
    }
    const mockWhere = vi.fn().mockReturnValue(mockWhereResult)
    const mockFromResult = { where: mockWhere }
    const mockFrom = vi.fn().mockReturnValue(mockFromResult)
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })

    return {
      select: mockSelect,
      from: mockFrom,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      _whereResult: mockWhereResult,
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

vi.mock('@/lib/tags/mapper', () => ({
  mapTagsToSectionType: vi.fn(async (tagNames: string[]) => {
    if (tagNames.includes('成果') || tagNames.includes('achievement')) return 'achievement'
    if (tagNames.includes('风险') || tagNames.includes('risk')) return 'risk'
    if (tagNames.includes('计划') || tagNames.includes('plan')) return 'plan'
    return 'routine'
  }),
}))

describe('/api/templates/[id]/render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should render official-general template with events', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '完成了用户认证模块开发',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          eventTime: new Date('2026-07-11T10:00:00'),
          source: 'manual',
          content: '准备下周技术分享会',
          status: 'pending',
          tags: ['计划'],
          sectionType: 'plan',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-general/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-general' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('完成了用户认证模块开发')
      expect(data.content).toContain('准备下周技术分享会')
      expect(data.content).not.toContain('{{本周完成}}')
      expect(data.content).not.toContain('{{下周计划}}')
      expect(data.templateId).toBe('official-general')
    })

    it('should render official-tech-dev template with events', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '完成订单模块开发 80%',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          eventTime: new Date('2026-07-09T10:00:00'),
          source: 'manual',
          content: '修复登录页面样式问题',
          status: 'pending',
          tags: ['风险'],
          sectionType: 'risk',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-tech-dev/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-tech-dev' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('完成订单模块开发 80%')
      expect(data.content).toContain('修复登录页面样式问题')
      expect(data.content).not.toContain('{{开发进度}}')
      expect(data.content).not.toContain('{{Bug修复}}')
      expect(data.templateId).toBe('official-tech-dev')
    })

    it('should render official-minimal template with events', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '完成项目 A 交付',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-minimal/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-minimal' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('完成项目 A 交付')
      expect(data.content).not.toContain('{{本周完成}}')
      expect(data.content).not.toContain('{{下周重点}}')
      expect(data.templateId).toBe('official-minimal')
    })

    it('should render official-personal-review template with events', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '成功上线新功能',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          eventTime: new Date('2026-07-09T10:00:00'),
          source: 'manual',
          content: '遇到数据库死锁问题',
          status: 'pending',
          tags: ['风险'],
          sectionType: 'risk',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-personal-review/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-personal-review' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('成功上线新功能')
      expect(data.content).toContain('遇到数据库死锁问题')
      expect(data.content).not.toContain('{{本周成果}}')
      expect(data.content).not.toContain('{{踩坑记录}}')
      expect(data.templateId).toBe('official-personal-review')
    })

    it('should filter only pending events', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '待处理事件',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          eventTime: new Date('2026-07-09T10:00:00'),
          source: 'manual',
          content: '已处理事件',
          status: 'processed',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-minimal/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-minimal' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('待处理事件')
      expect(data.content).not.toContain('已处理事件')
    })

    it('should return empty list items when no events', async () => {
      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve([]))

      const request = new Request('http://localhost/api/templates/official-minimal/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-minimal' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).not.toContain('{{本周完成}}')
      expect(data.content).not.toContain('{{下周重点}}')
      expect(data.content).toContain('## 本周完成')
      expect(data.content).toContain('## 下周重点')
    })

    it('should return 404 for non-existent official template', async () => {
      const request = new Request('http://localhost/api/templates/official-nonexistent/render?date=2026-07-13')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-nonexistent' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('模板不存在')
    })

    it('should return 400 for invalid date', async () => {
      const request = new Request('http://localhost/api/templates/official-minimal/render?date=invalid-date')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-minimal' }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('日期参数无效')
    })

    it('should respect viewType parameter', async () => {
      const mockEvents = [
        {
          id: 1,
          eventTime: new Date('2026-07-10T10:00:00'),
          source: 'manual',
          content: '测试事件',
          status: 'pending',
          tags: ['成果'],
          sectionType: 'achievement',
          isImportant: false,
          metadata: {},
          category: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const { getDb } = await import('@/lib/db')
      const db = getDb() as any
      db._whereResult.then.mockImplementation((resolve: (value: any) => void) => resolve(mockEvents))

      const request = new Request('http://localhost/api/templates/official-general/render?date=2026-07-13&viewType=leadership')
      const response = await GET(request, { params: Promise.resolve({ id: 'official-general' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.viewType).toBe('leadership')
      // Leadership view should only include enabled sections
      expect(data.content).toContain('## 本周完成')
      expect(data.content).toContain('## 下周计划')
    })
  })
})
