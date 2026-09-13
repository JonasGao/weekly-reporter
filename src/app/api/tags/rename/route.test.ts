import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from './route'
import { renameTagGlobally } from '@/lib/tags'

vi.mock('@/lib/tags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tags')>()
  return {
    ...actual,
    renameTagGlobally: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ getDb: vi.fn(() => ({})) }))

describe('/api/tags/rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renames a tag without merge', async () => {
    vi.mocked(renameTagGlobally).mockReturnValueOnce({ eventsUpdated: 2, merged: false })

    const request = new Request('http://localhost/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '工作', to: '任务' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.eventsUpdated).toBe(2)
    expect(data.merged).toBe(false)
    expect(renameTagGlobally).toHaveBeenCalledWith(expect.anything(), '工作', '任务')
  })

  it('reports merge=true when target tag already exists on some events', async () => {
    vi.mocked(renameTagGlobally).mockReturnValueOnce({ eventsUpdated: 1, merged: true })

    const request = new Request('http://localhost/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '工作', to: '任务' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.merged).toBe(true)
  })

  it('rejects invalid charset (hyphen) with VALIDATION_ERROR', async () => {
    const request = new Request('http://localhost/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'tag-name', to: '任务' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Validation failed')
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(data.details.issues)).toBe(true)
    expect(renameTagGlobally).not.toHaveBeenCalled()
  })

  it('rejects missing field with VALIDATION_ERROR', async () => {
    const request = new Request('http://localhost/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: '工作' }),
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.code).toBe('VALIDATION_ERROR')
    expect(renameTagGlobally).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON body with 500 (try/catch path)', async () => {
    const request = new Request('http://localhost/api/tags/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.code).toBe('RENAME_ERROR')
    expect(renameTagGlobally).not.toHaveBeenCalled()
  })
})
