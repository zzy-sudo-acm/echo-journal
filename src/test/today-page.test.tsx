import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TodayPage } from '../pages/TodayPage'
import { ToastProvider } from '../components/Toast'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { getLocalDateString } from '../utils/date'

function renderTodayPage() {
  return render(
    <ToastProvider>
      <TodayPage />
    </ToastProvider>,
  )
}

function localDateAt(dayOffset: number, hour: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, 0, 0, 0)
  return date
}

describe('TodayPage', () => {
  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0)
      return 0
    }))
    Element.prototype.scrollIntoView = vi.fn()
    await db.entries.clear()
    await db.tags.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('从上到下按日期和时间由旧到新排列日记', async () => {
    const twoDaysAgo = localDateAt(-2, 10)
    const yesterdayMorning = localDateAt(-1, 8)
    const yesterdayEvening = localDateAt(-1, 20)
    const today = localDateAt(0, 9)

    await entryRepo.create({ content: '前天的日记', createdAt: twoDaysAgo.toISOString() })
    await entryRepo.create({ content: '昨天晚上', createdAt: yesterdayEvening.toISOString() })
    await entryRepo.create({ content: '今天的日记', createdAt: today.toISOString() })
    await entryRepo.create({ content: '昨天早上', createdAt: yesterdayMorning.toISOString() })

    const { container } = renderTodayPage()
    await screen.findByText('今天的日记')

    await waitFor(() => {
      const dayIds = [...container.querySelectorAll<HTMLElement>('.day-group')].map((day) => day.id)
      expect(dayIds).toEqual([
        `day-${getLocalDateString(twoDaysAgo)}`,
        `day-${getLocalDateString(yesterdayMorning)}`,
        `day-${getLocalDateString(today)}`,
      ])
    })

    const yesterdayEntries = [...container.querySelectorAll(`#day-${getLocalDateString(yesterdayMorning)} .entry-content`)]
      .map((entry) => entry.textContent)
    expect(yesterdayEntries).toEqual(['昨天早上', '昨天晚上'])
  })
})
