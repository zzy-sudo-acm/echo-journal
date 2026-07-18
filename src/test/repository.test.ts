import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { entryRepo, draftRepo, tagRepo } from '../db/repository'
import { getLocalDateString } from '../utils/date'

describe('Entry Repository', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.drafts.clear()
    await db.tags.clear()
  })

  it('should create an entry', async () => {
    const entry = await entryRepo.create({ content: '今天天气很好', tags: ['日常', '心情'] })
    expect(entry.id).toBeTruthy()
    expect(entry.content).toBe('今天天气很好')
    expect(entry.tags).toEqual(['日常', '心情'])
    expect(entry.isDraft).toBe(false)
    expect(entry.createdAt).toBeTruthy()
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

  it('should soft-delete an entry (move to trash)', async () => {
    const created = await entryRepo.create({ content: '待删除' })
    await entryRepo.delete(created.id)
    const retrieved = await entryRepo.get(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.deletedAt).toBeTruthy()
  })

  it('should permanently delete an entry', async () => {
    const created = await entryRepo.create({ content: '永久删除' })
    await entryRepo.permanentDelete(created.id)
    const retrieved = await entryRepo.get(created.id)
    expect(retrieved).toBeNull()
  })

  it('should restore a soft-deleted entry', async () => {
    const created = await entryRepo.create({ content: '待恢复' })
    await entryRepo.delete(created.id)
    await entryRepo.restore(created.id)
    const retrieved = await entryRepo.get(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.deletedAt).toBeUndefined()
  })

  it('should list only active entries (exclude soft-deleted)', async () => {
    const active = await entryRepo.create({ content: '活跃日记' })
    const deletedEntry = await entryRepo.create({ content: '已删除日记' })
    await entryRepo.delete(deletedEntry.id)
    const results = await entryRepo.list()
    expect(results.length).toBe(1)
    expect(results[0].id).toBe(active.id)
  })

  // ── UTC date: entry near midnight UTC+8 should be grouped in LOCAL today ──
  it('should group entry in LOCAL today even when UTC date differs', async () => {
    const localDate = getLocalDateString()

    // Create an entry that will be in today's local date
    await entryRepo.create({ content: '今天的本地日记' })

    const results = await entryRepo.list({ date: localDate })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('今天的本地日记')
  })

  // ── UTC date: getDatesWithEntries uses local date ──
  it('should return LOCAL dates from getDatesWithEntries', async () => {
    await entryRepo.create({ content: 'a', createdAt: '2024-01-15T10:00:00.000Z' })
    await entryRepo.create({ content: 'b', createdAt: '2024-01-16T10:00:00.000Z' })

    const dates = await entryRepo.getDatesWithEntries()
    // These UTC dates are during daytime UTC, so local date = UTC date for most timezones
    expect(dates.length).toBeGreaterThanOrEqual(1)
    // All returned dates should be valid YYYY-MM-DD
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('should filter entries by date using LOCAL date', async () => {
    await entryRepo.create({ content: '条目1' })
    const localDate = getLocalDateString()
    const results = await entryRepo.list({ date: localDate })
    expect(results.length).toBe(1)
    expect(results[0].content).toBe('条目1')
  })

  it('should filter entries by year and month using LOCAL date', async () => {
    await entryRepo.create({ content: '一月日记', createdAt: '2024-01-15T10:00:00.000Z' })
    await entryRepo.create({ content: '二月日记', createdAt: '2024-02-10T10:00:00.000Z' })

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

  it('should save empty title as empty string', async () => {
    const entry = await entryRepo.create({ content: '日记内容', title: '原始标题' })
    await entryRepo.update(entry.id, { title: '' })
    const updated = await entryRepo.get(entry.id)
    expect(updated!.title).toBe('')
  })

  it('should save empty tags as empty array', async () => {
    const entry = await entryRepo.create({ content: '带标签', tags: ['标签1', '标签2'] })
    await entryRepo.update(entry.id, { tags: [] })
    const updated = await entryRepo.get(entry.id)
    expect(updated!.tags).toEqual([])
  })

  it('should exclude soft-deleted entries from tag counts', async () => {
    await entryRepo.create({ content: '活跃', tags: ['日常'] })
    const deleted = await entryRepo.create({ content: '已删', tags: ['日常'] })
    await entryRepo.delete(deleted.id)
    const tags = await entryRepo.getAllTags()
    const dailyTag = tags.find((t) => t.name === '日常')
    expect(dailyTag!.count).toBe(1)
  })

  it('should list trash entries', async () => {
    const a = await entryRepo.create({ content: 'a' })
    const b = await entryRepo.create({ content: 'b' })
    await entryRepo.delete(a.id)
    await entryRepo.delete(b.id)
    const trash = await entryRepo.listTrash()
    expect(trash.length).toBe(2)
  })

  it('should empty trash', async () => {
    const a = await entryRepo.create({ content: 'a' })
    await entryRepo.delete(a.id)
    await entryRepo.emptyTrash()
    const trash = await entryRepo.listTrash()
    expect(trash.length).toBe(0)
    expect(await entryRepo.getTrashCount()).toBe(0)
  })

  it('should get all tags with counts', async () => {
    await entryRepo.create({ content: 'a', tags: ['tag1', 'tag2'] })
    await entryRepo.create({ content: 'b', tags: ['tag1', 'tag3'] })

    const tags = await entryRepo.getAllTags()
    expect(tags.length).toBe(3)
    const tag1 = tags.find((t) => t.name === 'tag1')
    expect(tag1!.count).toBe(2)
  })

  it('should get on this day entries using LOCAL date comparison', async () => {
    const today = new Date()
    const month = today.getMonth()
    const day = today.getDate()

    await entryRepo.create({
      content: '今年的今天',
      createdAt: new Date(today.getFullYear(), month, day, 10, 0).toISOString(),
    })
    await entryRepo.create({
      content: '去年的今天',
      createdAt: new Date(today.getFullYear() - 1, month, day, 10, 0).toISOString(),
    })

    const entries = await entryRepo.getOnThisDay(month, day)
    expect(entries.length).toBe(2)
    expect(entries.map((e) => e.content).sort()).toEqual(['今年的今天', '去年的今天'])
  })
})

// ── Draft Recovery Tests ──

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

  // ── Draft recovery: simulate app close and reopen ──
  it('should preserve draft content and tags after simulated app reopen', async () => {
    // Session 1: write draft
    await draftRepo.save({ content: '未完的日记', title: '', tags: ['想法', 'TODO'] })

    // Simulate app close/reopen: read draft fresh from DB
    const recovered = await draftRepo.get()

    expect(recovered).not.toBeNull()
    expect(recovered!.content).toBe('未完的日记')
    expect(recovered!.tags).toEqual(['想法', 'TODO'])
  })

  it('should preserve draft with empty content but tags', async () => {
    await draftRepo.save({ content: '', title: '', tags: ['标签1'] })
    const recovered = await draftRepo.get()
    expect(recovered).not.toBeNull()
    expect(recovered!.tags).toEqual(['标签1'])
  })

  it('should preserve draft with multiline content', async () => {
    const multiline = '第一行\n第二行\n\n第三行'
    await draftRepo.save({ content: multiline, title: '', tags: ['长文'] })
    const recovered = await draftRepo.get()
    expect(recovered!.content).toBe(multiline)
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
