import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CollectPage from './page'
import {
  SyncAllSourcesProvider,
  useSyncAllSources,
} from '@/components/SyncAllSources'

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }))

vi.mock('@/components/CollectSourceList', () => ({
  CollectSourceList: ({ onRefresh }: { onRefresh: (refresh: () => void) => void }) => {
    useEffect(() => onRefresh(mockRefresh), [onRefresh])
    return <div>采集源列表</div>
  },
}))

vi.mock('@/components/ScanReposDialog', () => ({
  ScanReposDialog: () => null,
}))

vi.mock('@/components/SyncResultsCard', () => ({
  SyncResultsCard: () => null,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function ExternalSyncTrigger() {
  const { runSyncAll } = useSyncAllSources()
  return <button onClick={() => void runSyncAll()}>外部同步</button>
}

describe('CollectPage quick sync coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('refreshes the source list when a sync started elsewhere completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <ExternalSyncTrigger />
        <CollectPage />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: '外部同步' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
  })
})
