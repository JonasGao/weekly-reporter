import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, DELETE } from './route'
import { listTagsWithCounts, removeTagGlobally } from '@/lib/tags'

vi.mock('@/lib/tags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags')>()
  return {
    ...actual,
    listTagsWithCounts: vi.fn(),
    removeTagGlobally: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }))

describe('/api/tags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns tags from listTagsWithCounts', async () => {
      const mockTags = [
        { name: '工作', count: 2 },
        { name: '周报', count: 1 },
      ]
      vi.mocked(listTagsWithCounts).mockReturnValueOnce(mockTags)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tags).toEqual(mockTags)
    })

    it('returns empty array when no tags exist', async () => {
      vi.mocked(listTagsWithCounts).mockReturnValueOnce([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tags).toEqual([])
    })
  })

  describe('DELETE', () => {
    it('removes a tag globally by name', async () => {
      vi.mocked(removeTagGlobally).mockReturnValueOnce(3)

      const request = new Request('http://localhost/api/tags?name=%E5%B7%A5%E4%BD%9C')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.removed).toBe(3)
      expect(removeTagGlobally).toHaveBeenCalledWith(expect.anything(), '工作')
    })

    it('rejects invalid charset (hyphen)', async () => {
      const request = new Request('http://localhost/api/tags?name=tag-name')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid tag name')
      expect(data.code).toBe('INVALID_TAG_NAME')
      expect(removeTagGlobally).not.toHaveBeenCalled()
    })

    it('rejects missing name', async () => {
      const request = new Request('http://localhost/api/tags')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.code).toBe('INVALID_TAG_NAME')
      expect(removeTagGlobally).not.toHaveBeenCalled()
    })
  })
})
