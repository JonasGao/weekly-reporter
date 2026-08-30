import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Navigation } from './Navigation'
import { SyncAllSourcesProvider } from './SyncAllSources'

const { mockPathname } = vi.hoisted(() => ({ mockPathname: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('./Settings', () => ({
  SettingsButton: () => <button aria-label="设置" />,
}))

vi.mock('./ThemeSwitcher', () => ({
  ThemeSwitcher: () => <button aria-label="切换主题" />,
}))

describe('Navigation quick sync action', () => {
  it('places quick sync before settings and hides it on the collect page', () => {
    mockPathname.mockReturnValue('/')
    const { rerender } = render(
      <SyncAllSourcesProvider>
        <Navigation />
      </SyncAllSourcesProvider>,
    )

    const syncButton = screen.getByRole('button', { name: '同步全部采集源' })
    const settingsButton = screen.getByRole('button', { name: '设置' })
    expect(
      syncButton.compareDocumentPosition(settingsButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    mockPathname.mockReturnValue('/collect')
    rerender(
      <SyncAllSourcesProvider>
        <Navigation />
      </SyncAllSourcesProvider>,
    )

    expect(
      screen.queryByRole('button', { name: '同步全部采集源' }),
    ).not.toBeInTheDocument()

    mockPathname.mockReturnValue('/collect/new')
    rerender(
      <SyncAllSourcesProvider>
        <Navigation />
      </SyncAllSourcesProvider>,
    )

    expect(
      screen.getByRole('button', { name: '同步全部采集源' }),
    ).toBeInTheDocument()
  })
})
