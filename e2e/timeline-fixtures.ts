import { expect, type APIRequestContext } from '@playwright/test'

export async function seedTimelineReport(request: APIRequestContext, marker: string): Promise<number[]> {
  const response = await request.post('/api/e2e/fixtures', { data: { action: 'timeline', marker } })
  expect(response.status()).toBe(201)
  return ((await response.json()) as { reports: Array<{ id: number }> }).reports.map((report) => report.id)
}

export async function disposeTimelineReport(request: APIRequestContext, reportIds: number[]) {
  const response = await request.delete('/api/e2e/fixtures', { data: { reportIds } })
  expect(response.ok()).toBeTruthy()
}
