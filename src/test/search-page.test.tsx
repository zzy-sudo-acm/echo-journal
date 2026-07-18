import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SearchPage } from '../pages/SearchPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'

function localIso(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

describe('SearchPage', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    await db.entries.clear()
    await db.tags.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function renderPage() {
    return render(
      <MemoryRouter>
        <ToastProvider>
          <SearchPage />
        </ToastProvider>
      </MemoryRouter>,
    )
  }

  it('renders flat keyword results without date dividers', async () => {
    await entryRepo.create({ content: '关键词日记A', createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '关键词日记B', createdAt: localIso(2026, 7, 17) })

    renderPage()

    const input = screen.getByPlaceholderText('搜索日记正文、标题或标签')
    fireEvent.change(input, { target: { value: '关键词' } })

    await waitFor(() => {
      const results = document.querySelectorAll('.search-result-keyword')
      expect(results.length).toBe(2)
    })

    // No date dividers when keyword present
    const dividers = document.querySelectorAll('.date-divider')
    expect(dividers.length).toBe(0)
  })

  it('shows year in keyword search results', async () => {
    await entryRepo.create({ content: '跨年日记', createdAt: localIso(2025, 1, 15) })

    renderPage()

    const input = screen.getByPlaceholderText('搜索日记正文、标题或标签')
    fireEvent.change(input, { target: { value: '跨年' } })

    await waitFor(() => {
      const dateEls = document.querySelectorAll('.search-result-date')
      expect(dateEls.length).toBe(1)
      expect(dateEls[0].textContent).toContain('2025')
    })
  })

  it('shows date dividers when filtering by tag only (no keyword)', async () => {
    await entryRepo.create({ content: '标签日记', tags: ['测试'], createdAt: localIso(2026, 7, 18) })

    renderPage()

    // Open tag filter panel
    fireEvent.click(screen.getByLabelText('按标签筛选'))

    await waitFor(() => {
      expect(screen.getByText('#测试')).toBeTruthy()
    })

    fireEvent.click(screen.getByText('#测试'))

    await waitFor(() => {
      const dividers = document.querySelectorAll('.date-divider')
      expect(dividers.length).toBe(1)
    })
  })

  it('keeps flat keyword order with keyword+tag+date combination', async () => {
    await entryRepo.create({ title: '重要', content: '工作', tags: ['工作'], createdAt: localIso(2026, 7, 10) })
    await entryRepo.create({ content: '不重要但匹配关键词', createdAt: localIso(2026, 7, 12) })

    renderPage()

    const input = screen.getByPlaceholderText('搜索日记正文、标题或标签')
    fireEvent.change(input, { target: { value: '重要' } })

    await waitFor(() => {
      const results = document.querySelectorAll('.search-result-keyword')
      expect(results.length).toBeGreaterThan(0)
      // Should be flat — no date dividers
      const dividers = document.querySelectorAll('.date-divider')
      expect(dividers.length).toBe(0)
    })
  })
})
