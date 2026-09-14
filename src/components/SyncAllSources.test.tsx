import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import {
  CollectPageSyncButton,
  SyncAllSourcesButton,
  SyncAllSourcesProvider,
} from './SyncAllSources'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

describe('SyncAllSourcesButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('syncs every eligible source and reports the result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            sourceId: 1,
            sourceName: 'alpha',
            status: 'success',
            commitsCount: 3,
            eventsCount: 2,
          },
          {
            sourceId: 2,
            sourceName: 'beta',
            status: 'success',
            commitsCount: 1,
            eventsCount: 1,
          },
        ],
      }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/collect/git-remote/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Sync complete: 2 succeeded, 3 new events',
      )
    })
  })

  it('reports when no source is eligible for syncing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('No eligible sources to sync')
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('reports partial source failures and links to their details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: '部分采集源同步失败',
        code: 'PARTIAL_SYNC_FAILED',
        results: [
          {
            sourceId: 1,
            sourceName: 'alpha',
            status: 'success',
            commitsCount: 2,
            eventsCount: 2,
          },
          {
            sourceId: 2,
            sourceName: 'beta',
            status: 'failed',
            commitsCount: 0,
            eventsCount: 0,
            error: 'Access denied',
          },
        ],
      }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Sync complete: 1 succeeded, 1 failed',
        expect.objectContaining({
          description: 'beta: Access denied',
          action: expect.objectContaining({ label: 'View details' }),
        }),
      )
    })

    const options = vi.mocked(toast.error).mock.calls[0][1]
    expect(options?.action).toBeTypeOf('object')
    if (
      typeof options?.action === 'object' &&
      options.action !== null &&
      'onClick' in options.action
    ) {
      options.action.onClick({} as never)
    }
    expect(mockPush).toHaveBeenCalledWith('/collect')
  })

  it('warns when a source has failed branches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        results: [
          {
            sourceId: 1,
            sourceName: 'alpha',
            status: 'success',
            commitsCount: 2,
            eventsCount: 2,
            branches: [
              { name: 'main', status: 'success', commitsCount: 2 },
              {
                name: 'legacy',
                status: 'failed',
                commitsCount: 0,
                error: 'Branch not found',
              },
            ],
          },
        ],
      }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Sync complete, but 1 branches failed',
        expect.objectContaining({
          description: 'alpha / legacy: Branch not found',
          action: expect.objectContaining({ label: 'View details' }),
        }),
      )
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('reports request failures that have no source results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ error: '该仓库正在操作中，请稍后重试' }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('该仓库正在操作中，请稍后重试')
    })
    expect(toast.info).not.toHaveBeenCalled()
  })

  it('includes failed branches when source and branch failures occur together', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        results: [
          {
            sourceId: 1,
            sourceName: 'alpha',
            status: 'success',
            commitsCount: 1,
            eventsCount: 1,
            branches: [
              {
                name: 'legacy',
                status: 'failed',
                commitsCount: 0,
                error: 'Branch not found',
              },
            ],
          },
          {
            sourceId: 2,
            sourceName: 'beta',
            status: 'failed',
            commitsCount: 0,
            eventsCount: 0,
            error: 'Access denied',
          },
        ],
      }),
    })

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Sync complete: 1 succeeded, 1 failed; 1 more branches failed',
        expect.any(Object),
      )
    })
  })

  it('shares the running state between the header and collect page actions', async () => {
    let resolveFetch!: (value: unknown) => void
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const user = userEvent.setup()
    render(
      <SyncAllSourcesProvider>
        <SyncAllSourcesButton />
        <CollectPageSyncButton onResults={vi.fn()} />
      </SyncAllSourcesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Sync all sources' }))

    expect(screen.getByRole('button', { name: 'Sync all sources' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Syncing...' })).toBeDisabled()

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sync all sources' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Sync all' })).toBeEnabled()
    })
  })
})
