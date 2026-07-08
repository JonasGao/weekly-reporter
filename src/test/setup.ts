import '@testing-library/jest-dom'

// Mock ResizeObserver for cmdk
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = ResizeObserverMock as any
}

// Mock scrollIntoView for cmdk
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function() {} as any
}

// Only mock fetch in test environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  const originalFetch = global.fetch
  global.fetch = ((url: string | URL | Request, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url

    // Mock tag stats API
    if (urlString.includes('/api/tags/stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { name: '工作', color: '#3b82f6', usage_count: 10 },
          { name: '成果', color: '#10b981', usage_count: 8 },
          { name: '风险', color: '#ef4444', usage_count: 5 },
          { name: '计划', color: '#f59e0b', usage_count: 3 },
          { name: '会议', color: '#8b5cf6', usage_count: 2 },
          { name: '重要', color: '#ec4899', usage_count: 1 },
        ])
      })
    }

    // Mock tag creation API
    if (urlString.includes('/api/tags') && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: '新标签', color: null, usage_count: 0 })
      })
    }

    // Fallback to original fetch for other URLs
    return originalFetch(url, options)
  }) as typeof fetch
}
