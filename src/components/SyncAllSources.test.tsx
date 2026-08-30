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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    expect(mockFetch).toHaveBeenCalledWith('/api/collect/git-remote/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        '同步完成：成功 2 个，新增 3 条事件',
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('没有符合条件的采集源可同步')
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
            error: '访问失败',
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        '同步完成：成功 1 个，失败 1 个',
        expect.objectContaining({
          description: 'beta：访问失败',
          action: expect.objectContaining({ label: '查看详情' }),
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
                error: '分支不存在',
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        '同步完成，但有 1 个分支失败',
        expect.objectContaining({
          description: 'alpha / legacy：分支不存在',
          action: expect.objectContaining({ label: '查看详情' }),
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

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
                error: '分支不存在',
              },
            ],
          },
          {
            sourceId: 2,
            sourceName: 'beta',
            status: 'failed',
            commitsCount: 0,
            eventsCount: 0,
            error: '访问失败',
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        '同步完成：成功 1 个，失败 1 个，另有 1 个分支失败',
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

    await user.click(screen.getByRole('button', { name: '同步全部采集源' }))

    expect(screen.getByRole('button', { name: '同步全部采集源' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '同步中...' })).toBeDisabled()

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '同步全部采集源' })).toBeEnabled()
      expect(screen.getByRole('button', { name: '全部同步' })).toBeEnabled()
    })
  })
})
