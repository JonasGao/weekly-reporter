import { expect, type APIRequestContext } from '@playwright/test'

export interface HistoricalFixture {
  id: number
  kind: 'current' | 'stale' | 'legacy'
}

export async function seedHistoricalReports(request: APIRequestContext, marker: string): Promise<HistoricalFixture[]> {
  const response = await request.post('/api/e2e/fixtures', { data: { action: 'historical', marker } })
  expect(response.status()).toBe(201)
  return (await response.json()).reports as HistoricalFixture[]
}

export async function disposeHistoricalReports(request: APIRequestContext, reports: HistoricalFixture[]) {
  const response = await request.delete('/api/e2e/fixtures', { data: { reportIds: reports.map((report) => report.id) } })
  expect(response.ok()).toBeTruthy()
}
