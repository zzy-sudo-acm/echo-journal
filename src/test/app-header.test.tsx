import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { OPEN_FULL_EDITOR_EVENT, consumeFullEditorOpenRequest } from '../utils/events'

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
    // Drain any pending editor-open intent so tests stay isolated.
    consumeFullEditorOpenRequest()
  })

  it('requests the full editor in place when already on the timeline', () => {
    const openEditor = vi.fn()
    window.addEventListener(OPEN_FULL_EDITOR_EVENT, openEditor)

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppHeader />
        <CurrentPath />
      </MemoryRouter>,
    )
    clickWritingButton()

    expect(openEditor).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('当前路径').textContent).toBe('/')
    window.removeEventListener(OPEN_FULL_EDITOR_EVENT, openEditor)
  })

  it('navigates home and requests the editor when on another page', () => {
    const openEditor = vi.fn()
    window.addEventListener(OPEN_FULL_EDITOR_EVENT, openEditor)

    render(
      <MemoryRouter initialEntries={['/review']}>
        <AppHeader />
        <CurrentPath />
      </MemoryRouter>,
    )
    clickWritingButton()

    expect(screen.getByLabelText('当前路径').textContent).toBe('/')
    expect(openEditor).toHaveBeenCalledTimes(1)
    // The pending intent survives until the timeline page consumes it.
    expect(consumeFullEditorOpenRequest()).toBe(true)
    window.removeEventListener(OPEN_FULL_EDITOR_EVENT, openEditor)
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
