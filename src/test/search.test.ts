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

  it('ranks title-exact-match old entry above body-match new entry', async () => {
    await entryRepo.create({ title: '火锅', content: '一年前写的', createdAt: localIso(2025, 7, 1) })
    await entryRepo.create({ content: '今天又吃了火锅', createdAt: localIso(2026, 7, 18) })

    const results = await searchEntries('火锅')

    expect(results.length).toBe(2)
    expect(results[0].entry.title).toBe('火锅')
    expect(results[1].entry.content).toContain('火锅')
  })

  it('ranks title-partial-match above body-match', async () => {
    await entryRepo.create({ title: '火锅探店', content: '上周', createdAt: localIso(2026, 6, 1) })
    await entryRepo.create({ content: '今天吃了火锅', createdAt: localIso(2026, 7, 18) })

    const results = await searchEntries('火锅')

    expect(results.length).toBe(2)
    expect(results[0].entry.title).toContain('火锅')
    expect(results[1].entry.content).toContain('火锅')
  })

  it('breaks score ties by createdAt desc', async () => {
    // Both entries match the keyword in content only (same score)
    await entryRepo.create({ content: '今天吃了火锅', createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '昨天吃了火锅', createdAt: localIso(2026, 7, 17) })

    const results = await searchEntries('火锅')

    expect(results.length).toBe(2)
    expect(results[0].entry.content).toBe('今天吃了火锅')
    expect(results[1].entry.content).toBe('昨天吃了火锅')
  })

  it('ranks tag-exact-match above tag-partial-match', async () => {
    await entryRepo.create({ content: '分类A', tags: ['火锅'], createdAt: localIso(2026, 7, 1) })
    await entryRepo.create({ content: '分类B', tags: ['火锅店'], createdAt: localIso(2026, 7, 18) })

    const results = await searchEntries('火锅')

    expect(results.length).toBe(2)
    expect(results[0].entry.tags).toContain('火锅')
    expect(results[1].entry.tags).toContain('火锅店')
  })

  it('excludes deleted entries from search results', async () => {
    await entryRepo.create({ content: '活跃的火锅记录', createdAt: localIso(2026, 7, 18) })
    const deleted = await entryRepo.create({ content: '已删的火锅记录', createdAt: localIso(2026, 7, 18) })
    await entryRepo.delete(deleted.id)

    const results = await searchEntries('火锅')
    expect(results.length).toBe(1)
    expect(results[0].entry.content).toBe('活跃的火锅记录')
  })

  it('filters by tag only without keyword', async () => {
    await entryRepo.create({ content: '标签日记', tags: ['重要'], createdAt: localIso(2026, 7, 18) })
    await entryRepo.create({ content: '普通日记', tags: ['日常'], createdAt: localIso(2026, 7, 18) })

    const results = await searchEntries('', '重要')
    expect(results.length).toBe(1)
    expect(results[0].entry.content).toBe('标签日记')
  })

  it('combines keyword and tag filter', async () => {
    await entryRepo.create({ content: '重要的工作记录', tags: ['工作'] })
    await entryRepo.create({ content: '重要但私人的记录', tags: ['私人'] })

    const results = await searchEntries('重要', '工作')
    expect(results.length).toBe(1)
    expect(results[0].entry.content).toBe('重要的工作记录')
  })

  it('combines tag and date filter', async () => {
    await entryRepo.create({ content: '七月的工作', tags: ['工作'], createdAt: localIso(2026, 7, 10) })
    await entryRepo.create({ content: '八月的工作', tags: ['工作'], createdAt: localIso(2026, 8, 10) })

    const results = await searchEntries('', '工作', { mode: 'month', year: 2026, month: 6 })
    expect(results.length).toBe(1)
    expect(results[0].entry.content).toBe('七月的工作')
  })

  it('combines keyword, tag, and date filter', async () => {
    await entryRepo.create({ content: '七月的工作总结', tags: ['工作'], createdAt: localIso(2026, 7, 10) })
    await entryRepo.create({ content: '七月工作记录', tags: ['工作'], createdAt: localIso(2026, 7, 12) })
    await entryRepo.create({ content: '八月的工作总结', tags: ['工作'], createdAt: localIso(2026, 8, 10) })

    const results = await searchEntries('总结', '工作', { mode: 'month', year: 2026, month: 6 })
    expect(results.length).toBe(1)
    expect(results[0].entry.content).toBe('七月的工作总结')
  })
})
