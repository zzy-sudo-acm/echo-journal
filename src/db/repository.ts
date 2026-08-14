import { db } from './database'
import type {
  Entry,
  CreateEntryInput,
  UpdateEntryInput,
  EntryQuery,
  TagInfo,
  JournalMedia,
  CreateJournalMediaInput,
  UpdateJournalMediaInput,
} from './models'
import { v4 as uuidv4 } from './uuid'
import { toLocalDate } from '../utils/date'
import { collectMediaIds, extractPlainText } from '../services/richContent'

function generateId(): string {
  return uuidv4()
}

function nowISO(): string {
  return new Date().toISOString()
}

function normalizeIds(ids: Iterable<string>): string[] {
  return typeof ids === 'string' ? [ids] : [...ids]
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
      content: input.richContent ? extractPlainText(input.richContent) : input.content,
      ...(input.richContent ? { richContent: input.richContent } : {}),
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

    const hasRichContentPatch = patch.richContent !== undefined
    const nextRichContent = hasRichContentPatch
      ? (patch.richContent ?? undefined)
      : existing.richContent

    const updated: Entry = {
      ...existing,
      title: patch.title !== undefined ? patch.title : existing.title,
      content:
        hasRichContentPatch && nextRichContent
          ? extractPlainText(nextRichContent)
          : (patch.content ?? existing.content),
      tags: patch.tags ?? existing.tags,
      createdAt: patch.createdAt ?? existing.createdAt,
      isDraft: patch.isDraft ?? existing.isDraft,
      updatedAt: nowISO(),
    }
    if (nextRichContent) updated.richContent = nextRichContent
    else delete updated.richContent

    const previousMediaIds = hasRichContentPatch
      ? new Set(collectMediaIds(existing.richContent))
      : null
    const nextMediaIds = hasRichContentPatch
      ? new Set(collectMediaIds(nextRichContent))
      : null
    await db.entries.put(updated)

    // Refresh tag list
    if (patch.tags) {
      for (const tag of patch.tags) {
        await db.tags.put({ name: tag })
      }
    }

    if (previousMediaIds && nextMediaIds) {
      const removedMediaIds = [...previousMediaIds].filter((mediaId) => !nextMediaIds.has(mediaId))
      if (removedMediaIds.length > 0) await cleanupOrphanMedia(removedMediaIds)
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
    const existing = await db.entries.get(id)
    if (!existing) return
    const candidateMediaIds = collectMediaIds(existing.richContent)
    await db.entries.delete(id)
    if (candidateMediaIds.length > 0) await cleanupOrphanMedia(candidateMediaIds)
  },

  /** Permanently delete all non-draft soft-deleted entries in a single transaction */
  async emptyTrash(): Promise<void> {
    const candidateMediaIds = await db.transaction('rw', db.entries, async () => {
      const trashedEntries = await db.entries
        .filter((entry) => !entry.isDraft && Boolean(entry.deletedAt))
        .toArray()
      await db.entries.bulkDelete(trashedEntries.map((entry) => entry.id))
      return trashedEntries.flatMap((entry) => collectMediaIds(entry.richContent))
    })
    if (candidateMediaIds.length > 0) await cleanupOrphanMedia(candidateMediaIds)
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

export const mediaRepo = {
  async create(input: CreateJournalMediaInput): Promise<JournalMedia> {
    const media: JournalMedia = {
      id: input.id ?? generateId(),
      blob: input.blob,
      mimeType: input.mimeType || input.blob.type || 'application/octet-stream',
      width: input.width,
      height: input.height,
      ...(input.fileName ? { fileName: input.fileName } : {}),
      createdAt: input.createdAt ?? nowISO(),
    }
    await db.media.add(media)
    return media
  },

  async update(id: string, patch: UpdateJournalMediaInput): Promise<JournalMedia> {
    const existing = await db.media.get(id)
    if (!existing) throw new Error(`Media not found: ${id}`)

    const updated: JournalMedia = {
      ...existing,
      blob: patch.blob ?? existing.blob,
      mimeType: patch.mimeType || patch.blob?.type || existing.mimeType,
      width: patch.width ?? existing.width,
      height: patch.height ?? existing.height,
      ...(patch.fileName !== undefined ? { fileName: patch.fileName } : {}),
    }
    await db.media.put(updated)
    return updated
  },

  async put(media: JournalMedia): Promise<JournalMedia> {
    await db.media.put(media)
    return media
  },

  async get(id: string): Promise<JournalMedia | null> {
    return (await db.media.get(id)) ?? null
  },

  async getMany(ids: Iterable<string>): Promise<JournalMedia[]> {
    const orderedIds = normalizeIds(ids)
    if (orderedIds.length === 0) return []
    const records = await db.media.bulkGet(orderedIds)
    return records.filter((record): record is JournalMedia => Boolean(record))
  },

  async list(): Promise<JournalMedia[]> {
    return db.media.orderBy('createdAt').toArray()
  },

  async count(): Promise<number> {
    return db.media.count()
  },

  async delete(id: string): Promise<void> {
    await db.media.delete(id)
  },

  async deleteMany(ids: Iterable<string>): Promise<void> {
    const uniqueIds = [...new Set(normalizeIds(ids))]
    if (uniqueIds.length > 0) await db.media.bulkDelete(uniqueIds)
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectUnknownRichContentMediaIds(value: unknown, references: Set<string>): void {
  if (!isRecord(value)) return

  if (isRecord(value.attrs)) {
    const mediaId = value.attrs.mediaId
    if (typeof mediaId === 'string' && mediaId) references.add(mediaId)
  }

  if (Array.isArray(value.content)) {
    for (const child of value.content) collectUnknownRichContentMediaIds(child, references)
  }
}

/**
 * Add media roots held by a snapshot. New snapshots expose `mediaIds`; older
 * snapshots are inspected through their serialized backup data.
 */
function collectSnapshotMediaIds(
  snapshot: { mediaIds?: string[]; data: string },
  references: Set<string>,
): boolean {
  if (Array.isArray(snapshot.mediaIds)) {
    for (const mediaId of snapshot.mediaIds) {
      if (typeof mediaId === 'string' && mediaId) references.add(mediaId)
    }
    return true
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(snapshot.data) as unknown
  } catch {
    return false
  }

  if (!isRecord(parsed)) return false
  const payload = isRecord(parsed.data) ? parsed.data : parsed
  if (!Array.isArray(payload.entries)) return false

  for (const rawEntry of payload.entries) {
    if (isRecord(rawEntry)) {
      collectUnknownRichContentMediaIds(rawEntry.richContent, references)
    }
  }

  if (Array.isArray(payload.media)) {
    for (const rawMedia of payload.media) {
      if (isRecord(rawMedia) && typeof rawMedia.id === 'string' && rawMedia.id) {
        references.add(rawMedia.id)
      }
    }
  }

  return true
}

/**
 * Delete only media proven to be unreferenced by every entry and snapshot.
 * Supplying candidates makes post-save and permanent-delete cleanup cheap and
 * prevents unrelated media from being touched.
 */
export async function cleanupOrphanMedia(candidateIds?: Iterable<string>): Promise<number> {
  const normalizedCandidates = candidateIds === undefined
    ? null
    : [...new Set(normalizeIds(candidateIds).filter((mediaId) => mediaId))]
  if (normalizedCandidates?.length === 0) return 0

  return db.transaction('rw', [db.entries, db.snapshots, db.media], async () => {
    const entries = await db.entries.toArray()
    const snapshots = await db.snapshots.toArray()
    const candidates = normalizedCandidates
      ? (await db.media.bulkGet(normalizedCandidates)).filter(
          (record): record is JournalMedia => Boolean(record),
        )
      : await db.media.toArray()

    if (candidates.length === 0) return 0

    const referencedIds = new Set<string>()
    for (const entry of entries) {
      for (const mediaId of collectMediaIds(entry.richContent)) referencedIds.add(mediaId)
    }

    for (const snapshot of snapshots) {
      // If an old/corrupt snapshot cannot be inspected, keeping candidates is
      // safer than irreversibly deleting a Blob that snapshot might restore.
      if (!collectSnapshotMediaIds(snapshot, referencedIds)) return 0
    }

    const orphanIds = candidates
      .map((media) => media.id)
      .filter((mediaId) => !referencedIds.has(mediaId))
    if (orphanIds.length > 0) await db.media.bulkDelete(orphanIds)
    return orphanIds.length
  })
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
