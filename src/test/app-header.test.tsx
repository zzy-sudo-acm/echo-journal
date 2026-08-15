import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { FOCUS_COMPOSER_EVENT, consumeComposerFocusRequest } from '../utils/events'

function CurrentPath() {
  const { pathname } = useLocation()
  return <output aria-label="当前路径">{pathname}</output>
}

// Both the mobile capsule and the desktop bubble are named 编写 — jsdom does
// not evaluate media queries, so both are in the accessibility tree.
function clickWritingButton() {
  fireEvent.click(screen.getAllByRole('button', { name: '编写' })[0])
}

describe('AppHeader', () => {
  beforeEach(() => {
    // Reduced motion: skip WAAPI animations, which jsdom does not implement.
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    // Drain any pending composer-focus intent so tests stay isolated.
    consumeComposerFocusRequest()
  })

  it('requests composer focus in place when already on the timeline', () => {
    const focusComposer = vi.fn()
    window.addEventListener(FOCUS_COMPOSER_EVENT, focusComposer)

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppHeader />
        <CurrentPath />
      </MemoryRouter>,
    )
    clickWritingButton()

    expect(focusComposer).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('当前路径').textContent).toBe('/')
    window.removeEventListener(FOCUS_COMPOSER_EVENT, focusComposer)
  })

  it('navigates home and requests composer focus when on another page', () => {
    const focusComposer = vi.fn()
    window.addEventListener(FOCUS_COMPOSER_EVENT, focusComposer)

    render(
      <MemoryRouter initialEntries={['/review']}>
        <AppHeader />
        <CurrentPath />
      </MemoryRouter>,
    )
    clickWritingButton()

    expect(screen.getByLabelText('当前路径').textContent).toBe('/')
    expect(focusComposer).toHaveBeenCalledTimes(1)
    // The pending intent survives until the timeline composer consumes it.
    expect(consumeComposerFocusRequest()).toBe(true)
    window.removeEventListener(FOCUS_COMPOSER_EVENT, focusComposer)
  })

  it('treats review and trash as part of settings navigation', () => {
    render(
      <MemoryRouter initialEntries={['/review']}>
        <AppHeader />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: '设置' }).getAttribute('aria-current')).toBe('page')
    cleanup()

    render(
      <MemoryRouter initialEntries={['/trash']}>
        <AppHeader />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: '设置' }).getAttribute('aria-current')).toBe('page')
  })
})
