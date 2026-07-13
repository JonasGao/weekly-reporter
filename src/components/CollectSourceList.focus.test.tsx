import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollectSourceList } from './CollectSourceList'

const mockSources = Array.from({ length: 5 }, (_, i) => ({
  id: i + 1,
  type: 'git-remote',
  name: `source-${i + 1}`,
  config: {
    owner: 'owner',
    repo: `repo-${i + 1}`,
    token: '[ENCRYPTED]',
    authorEmails: ['a@example.com'],
  },
  enabled: true,
  status: 'enabled' as const,
  lastSyncAt: null,
  lastSyncStatus: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}))

describe('CollectSourceList search focus', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(global, 'fetch').mockImplementation((url: string | URL | Request) => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
      if (urlString.includes('/api/collect/sources')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sources: mockSources, total: mockSources.length, page: 1, pageSize: 12 }),
        } as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should keep focus on the search input while typing', async () => {
    const user = userEvent.setup()
    render(<CollectSourceList />)

    const input = await screen.findByPlaceholderText('搜索名称…')
    expect(input).toBeInTheDocument()

    await user.click(input)
    expect(input).toHaveFocus()

    // Type multiple characters and assert focus is never lost
    await user.type(input, 'source')

    expect(input).toHaveValue('source')
    expect(input).toHaveFocus()
  })

  it('should not remount the search input while typing', async () => {
    const user = userEvent.setup()
    render(<CollectSourceList />)

    const input = await screen.findByPlaceholderText('搜索名称…')
    const inputElement = input as HTMLElement

    // Track if input is removed from DOM during typing
    let removed = false
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.removedNodes)) {
          if (node === inputElement || (node instanceof Element && node.contains(inputElement))) {
            removed = true
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    await user.click(input)
    await user.type(input, 'repo')

    observer.disconnect()

    expect(removed).toBe(false)
    expect(input).toHaveValue('repo')
    expect(input).toHaveFocus()
  })
})
