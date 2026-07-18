import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { FOCUS_QUICK_INPUT_EVENT } from '../utils/events'

function CurrentPath() {
  const { pathname } = useLocation()
  return <output aria-label="当前路径">{pathname}</output>
}

describe('AppHeader desktop navigation', () => {
  const scrollTo = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.stubGlobal('scrollTo', scrollTo)
  })

  afterEach(() => {
    cleanup()
    scrollTo.mockReset()
    vi.unstubAllGlobals()
  })

  it('returns to the top without focusing QuickInput when already on the moment page', () => {
    const focusQuickInput = vi.fn()
    window.addEventListener(FOCUS_QUICK_INPUT_EVENT, focusQuickInput)

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppHeader />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: '编写' }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    expect(focusQuickInput).not.toHaveBeenCalled()
    window.removeEventListener(FOCUS_QUICK_INPUT_EVENT, focusQuickInput)
  })

  it('navigates to the moment page and treats review as part of settings', () => {
    render(
      <MemoryRouter initialEntries={['/review']}>
        <AppHeader />
        <CurrentPath />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '设置' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: '编写' }))

    expect(screen.getByLabelText('当前路径').textContent).toBe('/')
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
