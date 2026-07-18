import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { searchEntries } from '../services/search'
import { getLocalDateString, parseLocalDateString } from '../utils/date'
import type { Entry } from '../db/models'

function localIso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

describe('Search date filters', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
  })

  it('filters by one local day', async () => {
    await entryRepo.create({ content: '七月十八日', createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '七月十九日', createdAt: localIso(2026, 7, 19) })

    const results = await searchEntries('', undefined, { mode: 'day', date: '2026-07-18' })

    expect(results.map((result) => result.entry.content)).toEqual(['七月十八日'])
  })

  it('filters by local month', async () => {
    await entryRepo.create({ content: '七月记录', createdAt: localIso(2026, 7, 4) })
    await entryRepo.create({ content: '八月记录', createdAt: localIso(2026, 8, 4) })

    const results = await searchEntries('', undefined, { mode: 'month', year: 2026, month: 6 })

    expect(results.map((result) => result.entry.content)).toEqual(['七月记录'])
  })

  it('filters by inclusive date range', async () => {
    await entryRepo.create({ content: '范围之前', createdAt: localIso(2026, 7, 1) })
    await entryRepo.create({ content: '范围开始', createdAt: localIso(2026, 7, 5) })
    await entryRepo.create({ content: '范围结束', createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '范围之后', createdAt: localIso(2026, 7, 19) })

    const results = await searchEntries('', undefined, {
      mode: 'range',
      start: '2026-07-05',
      end: '2026-07-18',
    })

    expect(results.map((result) => result.entry.content).sort()).toEqual(['范围开始', '范围结束'])
  })

  it('combines keyword and date filters', async () => {
    await entryRepo.create({ content: '七月的苹果', createdAt: localIso(2026, 7, 12) })
    await entryRepo.create({ content: '七月的橘子', createdAt: localIso(2026, 7, 13) })
    await entryRepo.create({ content: '八月的苹果', createdAt: localIso(2026, 8, 12) })

    const results = await searchEntries('苹果', undefined, { mode: 'month', year: 2026, month: 6 })

    expect(results.map((result) => result.entry.content)).toEqual(['七月的苹果'])
  })

  it('clears the date filter back to all matching entries', async () => {
    await entryRepo.create({ content: '第一天', createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '第二天', createdAt: localIso(2026, 7, 19) })

    const filtered = await searchEntries('', undefined, { mode: 'day', date: '2026-07-18' })
    const cleared = await searchEntries('', undefined, { mode: 'all' })

    expect(filtered).toHaveLength(1)
    expect(cleared).toHaveLength(2)
  })

  it('uses the local date at the midnight boundary instead of slicing UTC', async () => {
    const nearLocalMidnight = new Date(2026, 6, 18, 0, 15)
    await entryRepo.create({ content: '本地午夜后的记录', createdAt: nearLocalMidnight.toISOString() })

    const results = await searchEntries('', undefined, {
      mode: 'day',
      date: getLocalDateString(nearLocalMidnight),
    })

    expect(results.map((result) => result.entry.content)).toEqual(['本地午夜后的记录'])
  })

  it('parses a calendar date as the same local day', () => {
    const parsed = parseLocalDateString('2026-07-18')

    expect(getLocalDateString(parsed)).toBe('2026-07-18')
    expect(parsed.getHours()).toBe(12)
  })

  it('searches legacy entries whose optional title or tags are missing', async () => {
    await db.entries.put({
      id: 'legacy-entry',
      content: '旧版本留下的搜索内容',
      createdAt: localIso(2026, 7, 18),
      updatedAt: localIso(2026, 7, 18),
      isDraft: false,
    } as Entry)

    const results = await searchEntries('搜索')

    expect(results.map((result) => result.entry.content)).toEqual(['旧版本留下的搜索内容'])
  })
})
