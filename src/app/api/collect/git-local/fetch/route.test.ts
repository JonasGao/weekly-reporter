import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { SourceOperationBusyError } from '@/lib/collect/source-operation-lock'

const { fetchLocalSource } = vi.hoisted(() => ({ fetchLocalSource: vi.fn() }))

vi.mock('@/lib/collect/git-local-fetch', () => ({ fetchLocalSource }))

describe('/api/collect/git-local/fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a successful fetch result', async () => {
    fetchLocalSource.mockResolvedValue({ sourceId: 1, sourceName: '本地仓库', status: 'success' })

    const response = await POST(new Request('http://localhost/api/collect/git-local/fetch', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 1 }),
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      result: { sourceId: 1, sourceName: '本地仓库', status: 'success' },
    })
  })

  it('rejects non-local sources', async () => {
    fetchLocalSource.mockResolvedValue({
      sourceId: 1,
      sourceName: 'GitHub',
      status: 'failed',
      error: '仅支持本地 Git 来源',
    })

    const response = await POST(new Request('http://localhost/api/collect/git-local/fetch', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 1 }),
    }))

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('FETCH_FAILED')
  })

  it('returns conflict while another source operation is running', async () => {
    fetchLocalSource.mockRejectedValue(new SourceOperationBusyError(1))

    const response = await POST(new Request('http://localhost/api/collect/git-local/fetch', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 1 }),
    }))

    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('SOURCE_BUSY')
  })
})
