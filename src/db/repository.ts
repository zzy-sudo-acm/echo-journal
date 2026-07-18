import { db } from './database'
import type { Entry, CreateEntryInput, UpdateEntryInput, EntryQuery, TagInfo } from './models'
import { v4 as uuidv4 } from './uuid'
import { toLocalDate } from '../utils/date'

function generateId(): string {
  return uuidv4()
}

function nowISO(): string {
  return new Date().toISOString()
}

/**
 * Check if an entry's createdAt falls on a specific LOCAL date.
 * createdAt is stored as ISO 8601 (UTC). We must parse it and compare
 * LOCAL date components, NOT slice the ISO string directly.
 */
function entryMatchesLocalDate(entry: Entry, localDate: string): boolean {
  return toLocalDate(entry.createdAt) === localDate
}

/**
 * Check if an entry's createdAt is in a specific LOCAL year/month.
 */
function entryMatchesLocalYearMonth(entry: Entry, year: number, month: number): boolean {
  const d = new Date(entry.createdAt)
  return d.getFullYear() === year && d.getMonth() === month
}

/**
 * Get LOCAL date string (YYYY-MM-DD) for an entry's createdAt.
 */
function entryLocalDate(entry: Entry): string {
  return toLocalDate(entry.createdAt)
}

/**
 * Get LOCAL month+day (MM-DD) for an entry's createdAt.
 */
function entryLocalMonthDay(entry: Entry): string {
  const d = new Date(entry.createdAt)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

// ── Helpers to filter deleted entries ──

function isActive(entry: Entry): boolean {
  return !entry.deletedAt
}

export const entryRepo = {
  async create(input: CreateEntryInput): Promise<Entry> {
    const now = nowISO()
    const entry: Entry = {
      id: generateId(),
      title: input.title ?? '',
      content: input.content,
      tags: input.tags || [],
      createdAt: input.createdAt || now,
      updatedAt: now,
      isDraft: input.isDraft || false,
    }
    await db.entries.put(entry)
    // Update tag counts
    for (const tag of entry.tags) {
      await db.tags.put({ name: tag })
    }
    return entry
  },

  async update(id: string, patch: UpdateEntryInput): Promise<Entry> {
    const existing = await db.entries.get(id)
    if (!existing) throw new Error(`Entry not found: ${id}`)

    const updated: Entry = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      content: patch.content ?? existing.content,
      tags: patch.tags ?? existing.tags,
      createdAt: patch.createdAt ?? existing.createdAt,
      isDraft: patch.isDraft ?? existing.isDraft,
      updatedAt: nowISO(),
    }
    await db.entries.put(updated)

    // Refresh tag list
    if (patch.tags) {
      for (const tag of patch.tags) {
        await db.tags.put({ name: tag })
      }
    }
    return updated
  },

  /** Soft-delete: move to trash instead of permanent removal */
  async delete(id: string): Promise<void> {
    const existing = await db.entries.get(id)
    if (!existing) return
    existing.deletedAt = nowISO()
    existing.updatedAt = nowISO()
    await db.entries.put(existing)
  },

  /** Restore from trash */
  async restore(id: string): Promise<Entry> {
    const existing = await db.entries.get(id)
    if (!existing) throw new Error(`Entry not found: ${id}`)
    const { deletedAt: _deletedAt, ...rest } = existing
    const restored: Entry = {
      ...rest,
      updatedAt: nowISO(),
    }
    await db.entries.put(restored)
    // Rebuild tag counts
    for (const tag of restored.tags) {
      await db.tags.put({ name: tag })
    }
    return restored
  },

  /** Permanently delete a single entry */
  async permanentDelete(id: string): Promise<void> {
    await db.entries.delete(id)
  },

  /** Permanently delete all soft-deleted entries in a single transaction */
  async emptyTrash(): Promise<void> {
    await db.transaction('rw', db.entries, async () => {
      await db.entries.filter((e) => Boolean(e.deletedAt)).delete()
    })
  },

  /** Count soft-deleted entries */
  async getTrashCount(): Promise<number> {
    return db.entries.filter((e) => Boolean(e.deletedAt)).count()
  },

  /** List soft-deleted entries (for trash page) */
  async listTrash(): Promise<Entry[]> {
    const entries = await db.entries.filter((e) => Boolean(e.deletedAt)).toArray()
    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return entries
  },

  async get(id: string): Promise<Entry | null> {
    return (await db.entries.get(id)) ?? null
  },

  async list(query: EntryQuery = {}): Promise<Entry[]> {
    let entries = await db.entries.toArray()

    // Exclude soft-deleted entries (unless querying drafts)
    if (query.isDraft === undefined || !query.isDraft) {
      entries = entries.filter(isActive)
    }

    // Filter drafts
    if (query.isDraft !== undefined) {
      entries = entries.filter((e) => e.isDraft === query.isDraft)
    } else {
      entries = entries.filter((e) => !e.isDraft)
    }

    // Filter by LOCAL date
    if (query.date) {
      entries = entries.filter((e) => entryMatchesLocalDate(e, query.date!))
    }

    // Filter by LOCAL year/month
    if (query.year !== undefined && query.month !== undefined) {
      entries = entries.filter((e) => entryMatchesLocalYearMonth(e, query.year!, query.month!))
    }

    // Filter by tag
    if (query.tag) {
      entries = entries.filter((e) => e.tags.includes(query.tag!))
    }

    // Filter by keyword
    if (query.keyword) {
      const kw = query.keyword.toLowerCase()
      entries = entries.filter(
        (e) =>
          e.content.toLowerCase().includes(kw) ||
          (e.title || '').toLowerCase().includes(kw) ||
          (e.tags || []).some((t) => t.toLowerCase().includes(kw)),
      )
    }

    // Sort
    const orderBy = query.orderBy || 'createdAt'
    const orderDir = query.orderDir || 'desc'
    entries.sort((a, b) => {
      const va = a[orderBy]
      const vb = b[orderBy]
      if (va < vb) return orderDir === 'asc' ? -1 : 1
      if (va > vb) return orderDir === 'asc' ? 1 : -1
      return 0
    })

    const start = query.offset ?? 0
    const end = query.limit !== undefined ? start + query.limit : undefined
    return entries.slice(start, end)
  },

  async getDatesWithEntries(): Promise<string[]> {
    const entries = await db.entries.filter((e) => !e.isDraft).toArray()
    const dates = new Set<string>()
    for (const e of entries) {
      if (isActive(e)) dates.add(entryLocalDate(e))
    }
    return Array.from(dates).sort()
  },

  async getAllTags(): Promise<TagInfo[]> {
    const entries = await db.entries.filter((e) => !e.isDraft).toArray()
    const tagMap = new Map<string, number>()
    for (const e of entries) {
      if (!isActive(e)) continue
      for (const tag of e.tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1)
      }
    }
    return Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async getEntryCount(): Promise<number> {
    return db.entries.filter((e) => !e.isDraft && !e.deletedAt).count()
  },

  async getOnThisDay(month: number, day: number): Promise<Entry[]> {
    const targetMmdd = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    const entries = await db.entries.filter((e) => !e.isDraft).toArray()
    return entries
      .filter((e) => isActive(e) && entryLocalMonthDay(e) === targetMmdd)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
}

export const draftRepo = {
  async save(draft: { content: string; title: string; tags: string[] }): Promise<void> {
    await db.drafts.put({
      id: 'current',
      ...draft,
      savedAt: nowISO(),
    })
  },

  async get(): Promise<{ content: string; title: string; tags: string[] } | null> {
    const draft = await db.drafts.get('current')
    if (!draft) return null
    return {
      content: draft.content,
      title: draft.title,
      tags: draft.tags,
    }
  },

  async clear(): Promise<void> {
    await db.drafts.delete('current')
  },
}

export const tagRepo = {
  async remove(name: string): Promise<void> {
    const entries = await db.entries.filter((e) => e.tags.includes(name)).toArray()
    for (const entry of entries) {
      entry.tags = entry.tags.filter((t) => t !== name)
      await db.entries.put(entry)
    }
    await db.tags.delete(name)
  },

  async rename(oldName: string, newName: string): Promise<void> {
    const entries = await db.entries.filter((e) => e.tags.includes(oldName)).toArray()
    for (const entry of entries) {
      entry.tags = entry.tags.map((t) => (t === oldName ? newName : t))
      await db.entries.put(entry)
    }
    await db.tags.delete(oldName)
    await db.tags.put({ name: newName })
  },
}

export const settingsRepo = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const record = await db.settings.get(key)
    return (record?.value as T) ?? fallback
  },

  async set(key: string, value: unknown): Promise<void> {
    await db.settings.put({ key, value })
  },
}
