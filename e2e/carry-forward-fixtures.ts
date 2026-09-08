import { expect, type APIRequestContext } from '@playwright/test'

export interface CarryForwardFixture {
  targetReportId: number
  reportIds: number[]
  eventIds: number[]
}

export async function seedCarryForward(
  request: APIRequestContext,
  marker: string,
  mode?: 'empty' | 'stale' | 'none' | 'legacy',
): Promise<CarryForwardFixture> {
  const response = await request.post('/api/e2e/fixtures', { data: { action: 'carry-forward', marker, mode } })
  expect(response.status()).toBe(201)
  return await response.json() as CarryForwardFixture
}

export async function disposeCarryForward(request: APIRequestContext, fixture: CarryForwardFixture) {
  const response = await request.delete('/api/e2e/fixtures', { data: { reportIds: fixture.reportIds, eventIds: fixture.eventIds } })
  expect(response.ok()).toBeTruthy()
}
