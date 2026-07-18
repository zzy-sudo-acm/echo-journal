import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

describe('BottomNav', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function getLink(label: string) {
    return screen.getByText(label).closest('a')
  }

  it('activates settings on /trash', () => {
    render(
      <MemoryRouter initialEntries={['/trash']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const link = getLink('设置')!
    expect(link.className).toContain('active')
  })

  it('activates settings on /review', () => {
    render(
      <MemoryRouter initialEntries={['/review']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const link = getLink('设置')!
    expect(link.className).toContain('active')
  })

  it('activates settings on /settings', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const link = getLink('设置')!
    expect(link.className).toContain('active')
  })

  it('does not activate home on /trash', () => {
    render(
      <MemoryRouter initialEntries={['/trash']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const link = getLink('此刻')!
    expect(link.className).not.toContain('active')
  })

  it('background indicator is at index 3 for /trash', () => {
    render(
      <MemoryRouter initialEntries={['/trash']}>
        <BottomNav />
      </MemoryRouter>,
    )

    const indicator = document.querySelector('.bottom-nav-indicator') as HTMLElement
    expect(indicator.style.transform).toContain('translate3d(300%, 0, 0)')
  })
})
