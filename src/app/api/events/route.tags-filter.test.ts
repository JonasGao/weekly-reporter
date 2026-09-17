import { describe, it, expect } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { rawEvents } from '@/lib/db/schema'
import { syncEventTags } from '@/lib/tags'

// Real-SQLite regression test: the tag-filter branch builds a raw IN-list in an
// EXISTS subquery, which the fully-mocked route.test.ts cannot exercise.
describe('/api/events GET tag filtering (real db)', () => {
  function seedEvent(content: string, tags: string[], minutesFromNow: number) {
    const db = getDb()
    const eventTime = new Date(Date.now() + minutesFromNow * 60_000)
    return db.transaction((tx) => {
      const event = tx.insert(rawEvents).values({
        content,
        eventTime,
        source: 'manual',
        isImportant: false,
        createdAt: eventTime,
        updatedAt: eventTime,
      }).returning().get()
      syncEventTags(tx, event.id, tags)
      return event
    })
  }

  it('returns only events carrying the selected single tag', async () => {
    const marker = `tagfilter-single-${Date.now()}`
    seedEvent(`${marker} 个人事项 #个人`, ['个人'], 0)
    seedEvent(`${marker} 工作事项 #工作`, ['工作'], -1)

    const res = await GET(
      new Request('http://localhost/api/events?limit=30&tags=' + encodeURIComponent('个人')),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const contents = data.events.map((e: { content: string }) => e.content)
    expect(contents.some((c: string) => c.startsWith(marker) && c.includes('个人事项'))).toBe(true)
    expect(contents.some((c: string) => c.startsWith(marker) && c.includes('工作事项'))).toBe(false)
  })

  it('accepts multiple comma-separated tags (OR semantics)', async () => {
    const marker = `tagfilter-multi-${Date.now()}`
    seedEvent(`${marker} 个人事项 #个人`, ['个人'], 0)
    seedEvent(`${marker} 工作事项 #工作`, ['工作'], -1)

    const res = await GET(
      new Request(
        'http://localhost/api/events?limit=30&tags=' +
          encodeURIComponent('个人') + ',' + encodeURIComponent('工作'),
      ),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const contents = data.events.map((e: { content: string }) => e.content)
    expect(contents.some((c: string) => c.startsWith(marker) && c.includes('个人事项'))).toBe(true)
    expect(contents.some((c: string) => c.startsWith(marker) && c.includes('工作事项'))).toBe(true)
  })

  it('returns an empty page (not 500) for an unused tag', async () => {
    const res = await GET(
      new Request('http://localhost/api/events?limit=30&tags=' + encodeURIComponent('确定不存在的标签xyz')),
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.events).toEqual([])
  })
})
