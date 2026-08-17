import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('/api/templates/[id]/render', () => {
  it('rejects the removed deterministic weekly-report renderer', async () => {
    const response = await GET()
    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({ code: 'TEMPLATE_RENDER_REMOVED' })
  })
})
