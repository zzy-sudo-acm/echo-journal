import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { entryRepo, draftRepo, tagRepo } from '../db/repository'

describe('Entry Repository', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.drafts.clear()
    await db.tags.clear()
  })

  it('should create an entry', async () => {
    const entry = await entryRepo.create({
      content: '今天天气很好',
      tags: ['日常', '心情'],
    })

    expect(entry.id).toBeTruthy()
    expect(entry.content).toBe('今天天气很好')
    expect(entry.tags).toEqual(['日常', '心情'])
    expect(entry.isDraft).toBe(false)
    expect(entry.createdAt).toBeTruthy()
    expect(entry.updatedAt).toBeTruthy()
  })

  it('should create and retrieve an entry', async () => {
    const created = await entryRepo.create({ content: '测试日记' })
    const retrieved = await entryRepo.get(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.content).toBe('测试日记')
  })

  it('should update an entry', async () => {
    const created = await entryRepo.create({ content: '原始内容', tags: ['test'] })
    const updated = await entryRepo.update(created.id, { content: '更新内容', tags: ['test', 'new'] })

    expect(updated.content).toBe('更新内容')
    expect(updated.tags).toEqual(['test', 'new'])
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime())
  })

  it('should delete an entry', async () => {
    const created = await entryRepo.create({ content: '待删除' })
    await entryRepo.delete(created.id)
    const retrieved = await entryRepo.get(created.id)
    expect(retrieved).toBeNull()
  })

  it('should filter entries by date', async () => {
    await entryRepo.create({ content: '今天的日记' })
    await entryRepo.create({
      content: '昨天的日记',
      createdAt: '2024-01-14T10:00:00.000Z',
    })

    const today = new Date().toISOString().slice(0, 10)
    const results = await entryRepo.list({ date: today })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('今天的日记')
  })

  it('should filter entries by year and month', async () => {
    await entryRepo.create({
      content: '一月日记',
      createdAt: '2024-01-15T10:00:00.000Z',
    })
    await entryRepo.create({
      content: '二月日记',
      createdAt: '2024-02-10T10:00:00.000Z',
    })

    const results = await entryRepo.list({ year: 2024, month: 0 }) // January
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('一月日记')
  })

  it('should filter entries by tag', async () => {
    await entryRepo.create({ content: '工作日记', tags: ['工作'] })
    await entryRepo.create({ content: '生活日记', tags: ['生活'] })

    const results = await entryRepo.list({ tag: '工作' })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('工作日记')
  })

  it('should search entries by keyword', async () => {
    await entryRepo.create({ content: '今天吃了火锅' })
    await entryRepo.create({ content: '今天看了电影' })
    await entryRepo.create({ content: '天气不错' })

    const results = await entryRepo.list({ keyword: '火锅' })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('今天吃了火锅')
  })

  it('should exclude drafts by default', async () => {
    await entryRepo.create({ content: '正式日记', isDraft: false })
    await entryRepo.create({ content: '草稿', isDraft: true })

    const results = await entryRepo.list()
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('正式日记')
  })

  it('should list entries in desc order by default', async () => {
    await entryRepo.create({ content: '第一条', createdAt: '2024-01-01T10:00:00.000Z' })
    await entryRepo.create({ content: '第二条', createdAt: '2024-01-02T10:00:00.000Z' })

    const results = await entryRepo.list()
    expect(results[0].content).toBe('第二条')
    expect(results[1].content).toBe('第一条')
  })

  it('should get dates with entries', async () => {
    await entryRepo.create({ content: 'a', createdAt: '2024-01-15T10:00:00.000Z' })
    await entryRepo.create({ content: 'b', createdAt: '2024-01-16T10:00:00.000Z' })
    await entryRepo.create({ content: 'c', createdAt: '2024-01-15T15:00:00.000Z' })

    const dates = await entryRepo.getDatesWithEntries()
    expect(dates).toEqual(['2024-01-15', '2024-01-16'])
  })

  it('should get all tags with counts', async () => {
    await entryRepo.create({ content: 'a', tags: ['tag1', 'tag2'] })
    await entryRepo.create({ content: 'b', tags: ['tag1', 'tag3'] })

    const tags = await entryRepo.getAllTags()
    expect(tags.length).toBe(3)
    const tag1 = tags.find((t) => t.name === 'tag1')
    expect(tag1!.count).toBe(2)
  })

  it('should get on this day entries', async () => {
    const today = new Date()
    const month = today.getMonth()
    const day = today.getDate()

    // Current year entry
    await entryRepo.create({
      content: '今年的今天',
      createdAt: new Date(today.getFullYear(), month, day, 10, 0).toISOString(),
    })
    // Last year entry
    await entryRepo.create({
      content: '去年的今天',
      createdAt: new Date(today.getFullYear() - 1, month, day, 10, 0).toISOString(),
    })
    // Different day
    await entryRepo.create({
      content: '其他日子',
      createdAt: new Date(today.getFullYear(), month, day + 1 > 28 ? day - 1 : day + 1, 10, 0).toISOString(),
    })

    const entries = await entryRepo.getOnThisDay(month, day)
    expect(entries.length).toBe(2)
  })
})

describe('Draft Repository', () => {
  beforeEach(async () => {
    await db.drafts.clear()
  })

  it('should save and retrieve draft', async () => {
    await draftRepo.save({ content: '草稿内容', title: '', tags: ['标签'] })

    const draft = await draftRepo.get()
    expect(draft).not.toBeNull()
    expect(draft!.content).toBe('草稿内容')
    expect(draft!.tags).toEqual(['标签'])
  })

  it('should update draft on repeated save', async () => {
    await draftRepo.save({ content: '版本1', title: '', tags: [] })
    await draftRepo.save({ content: '版本2', title: '', tags: ['new'] })

    const draft = await draftRepo.get()
    expect(draft!.content).toBe('版本2')
    expect(draft!.tags).toEqual(['new'])
  })

  it('should clear draft', async () => {
    await draftRepo.save({ content: '草稿', title: '', tags: [] })
    await draftRepo.clear()

    const draft = await draftRepo.get()
    expect(draft).toBeNull()
  })
})

describe('Tag Repository', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
  })

  it('should remove tag from all entries', async () => {
    await entryRepo.create({ content: 'a', tags: ['tag1', 'tag2'] })
    await entryRepo.create({ content: 'b', tags: ['tag1'] })

    await tagRepo.remove('tag1')

    const entries = await entryRepo.list()
    for (const e of entries) {
      expect(e.tags).not.toContain('tag1')
    }
  })

  it('should rename tag', async () => {
    await entryRepo.create({ content: 'a', tags: ['old'] })

    await tagRepo.rename('old', 'new')

    const entries = await entryRepo.list()
    expect(entries[0].tags).toContain('new')
    expect(entries[0].tags).not.toContain('old')
  })
})
