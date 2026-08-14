import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { getLocalDateString } from '../utils/date'

/** createdAt ISO for a local datetime. */
function localISO(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month, day, hour).toISOString()
}

function daysAgoISO(days: number, hour = 12): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour).toISOString()
}

describe('repository range queries', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.drafts.clear()
    await db.tags.clear()
  })

  describe('listRecentDays', () => {
    it('returns only active entries within the window, ascending', async () => {
      const recent = await entryRepo.create({ content: '最近', createdAt: daysAgoISO(2) })
      const older = await entryRepo.create({ content: '较早', createdAt: daysAgoISO(6) })
      await entryRepo.create({ content: '太早', createdAt: daysAgoISO(8) })
      const draft = await entryRepo.create({ content: '草稿', isDraft: true, createdAt: daysAgoISO(1) })
      const trashed = await entryRepo.create({ content: '回收站', createdAt: daysAgoISO(1) })
      await entryRepo.delete(trashed.id)

      const results = await entryRepo.listRecentDays(7)

      expect(results.map((entry) => entry.id)).toEqual([older.id, recent.id])
      expect(results.some((entry) => entry.id === draft.id)).toBe(false)
    })

    it('includes an entry created earlier today', async () => {
      const entry = await entryRepo.create({ content: '今天' })
      const results = await entryRepo.listRecentDays(1)
      expect(results.map((item) => item.id)).toContain(entry.id)
    })
  })

  describe('listByDate', () => {
    it('returns entries on the given local date only', async () => {
      const target = getLocalDateString(new Date(2024, 4, 10))
      const onDate = await entryRepo.create({ content: '当天', createdAt: localISO(2024, 4, 10, 9) })
      await entryRepo.create({ content: '前一天', createdAt: localISO(2024, 4, 9, 23) })
      await entryRepo.create({ content: '后一天', createdAt: localISO(2024, 4, 11, 1) })

      const results = await entryRepo.listByDate(target)
      expect(results.map((entry) => entry.id)).toEqual([onDate.id])
    })

    it('excludes drafts and trashed entries', async () => {
      const target = getLocalDateString(new Date(2024, 4, 10))
      await entryRepo.create({ content: '草稿', isDraft: true, createdAt: localISO(2024, 4, 10, 10) })
      const trashed = await entryRepo.create({ content: '已删', createdAt: localISO(2024, 4, 10, 11) })
      await entryRepo.delete(trashed.id)

      expect(await entryRepo.listByDate(target)).toEqual([])
    })
  })

  describe('getDatesInMonth', () => {
    it('marks only dates with active entries in that month', async () => {
      await entryRepo.create({ content: '五一', createdAt: localISO(2024, 4, 1) })
      await entryRepo.create({ content: '五二', createdAt: localISO(2024, 4, 2) })
      await entryRepo.create({ content: '六月', createdAt: localISO(2024, 5, 1) })
      const trashed = await entryRepo.create({ content: '已删', createdAt: localISO(2024, 4, 3) })
      await entryRepo.delete(trashed.id)

      const dates = await entryRepo.getDatesInMonth(2024, 4)
      expect(dates).toEqual(['2024-05-01', '2024-05-02'])
    })
  })

  describe('hasEntriesBeyondDays', () => {
    it('is false when everything is inside the window', async () => {
      await entryRepo.create({ content: '近', createdAt: daysAgoISO(3) })
      expect(await entryRepo.hasEntriesBeyondDays(7)).toBe(false)
    })

    it('is true when something older exists (even trashed)', async () => {
      const old = await entryRepo.create({ content: '旧', createdAt: daysAgoISO(30) })
      await entryRepo.delete(old.id)
      expect(await entryRepo.hasEntriesBeyondDays(7)).toBe(true)
    })

    it('is false for an empty database', async () => {
      expect(await entryRepo.hasEntriesBeyondDays(7)).toBe(false)
    })
  })
})
