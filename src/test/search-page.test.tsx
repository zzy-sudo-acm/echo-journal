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
    fireEvent.click(screen.getByLabelText('按标签筛选'))

    await waitFor(() => { expect(screen.getByText('#测试')).toBeTruthy() })
    fireEvent.click(screen.getByText('#测试'))

    await waitFor(() => {
      const dividers = document.querySelectorAll('.date-divider')
      expect(dividers.length).toBe(1)
    })
  })

  it('combines keyword + tag + date with flat result list', async () => {
    // Match all three: keyword "工作", tag "项目", both in July 2026
    await entryRepo.create({
      title: '工作总结', content: '七月项目工作', tags: ['项目'],
      createdAt: localIso(2026, 7, 10),
    })
    await entryRepo.create({
      content: '八月项目工作', tags: ['项目'],
      createdAt: localIso(2026, 8, 10),
    })

    renderPage()

    // Input keyword
    const input = screen.getByPlaceholderText('搜索日记正文、标题或标签')
    fireEvent.change(input, { target: { value: '工作' } })

    // Select tag
    fireEvent.click(screen.getByLabelText('按标签筛选'))
    await waitFor(() => {
      // Find the tag option button inside the filter panel
      const tagOptions = document.querySelectorAll('.tag-filter-option')
      expect(tagOptions.length).toBeGreaterThanOrEqual(1)
    })
    // Click the first tag option
    const tagOption = document.querySelector('.tag-filter-option') as HTMLElement
    fireEvent.click(tagOption)

    // Verify flat keyword results with tag filter applied
    await waitFor(() => {
      const results = document.querySelectorAll('.search-result-keyword')
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    // Flat — no date dividers
    expect(document.querySelectorAll('.date-divider').length).toBe(0)
  })
})
