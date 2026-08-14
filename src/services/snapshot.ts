import { db } from '../db/database'
import type { BackupData, InternalSnapshot } from '../db/models'
import { cleanupOrphanMedia } from '../db/repository'
import { v4 as uuidv4 } from '../db/uuid'
import { getLocalDateString, toLocalDate } from '../utils/date'
import { generateBackupData } from './backup'
import { collectMediaIds } from './richContent'
import { validateBackupData, verifyChecksum } from './validation'

const MAX_SNAPSHOTS = 7

function referencedMediaIds(data: BackupData): string[] {
  const ids = new Set<string>()
  for (const entry of data.entries) {
    for (const mediaId of collectMediaIds(entry.richContent)) ids.add(mediaId)
  }
  return [...ids]
}

function reserveUuid(reservedIds: Set<string>): string {
  let id = uuidv4()
  while (reservedIds.has(id)) id = uuidv4()
  reservedIds.add(id)
  return id
}

async function replaceSavedEntriesPreservingDrafts(entries: BackupData['entries']): Promise<void> {
  const drafts = await db.entries.filter((entry) => entry.isDraft).toArray()
  const occupiedIds = new Set(drafts.map((entry) => entry.id))
  const reservedIds = new Set([...occupiedIds, ...entries.map((entry) => entry.id)])

  await db.entries.filter((entry) => !entry.isDraft).delete()
  for (const entry of entries) {
    const restoredEntry = occupiedIds.has(entry.id)
      ? { ...entry, id: reserveUuid(reservedIds) }
      : entry
    await db.entries.add(restoredEntry)
    occupiedIds.add(restoredEntry.id)
  }
}

function mediaIdsFromSnapshot(snapshot: InternalSnapshot): string[] {
  if (snapshot.mediaIds) return snapshot.mediaIds
  try {
    return referencedMediaIds(JSON.parse(snapshot.data) as BackupData)
  } catch {
    return []
  }
}

async function ensureMediaAvailable(mediaIds: Iterable<string>, context: string): Promise<void> {
  const ids = [...new Set(mediaIds)]
  if (ids.length === 0) return
  const records = await db.media.bulkGet(ids)
  const missing = ids.filter((_, index) => !records[index])
  if (missing.length > 0) {
    throw new Error(`${context}引用的图片不存在: ${missing.join(', ')}`)
  }
}

async function cleanupMediaBestEffort(mediaIds: Iterable<string>): Promise<void> {
  const candidates = [...new Set(mediaIds)]
  if (candidates.length === 0) return
  try {
    await cleanupOrphanMedia(candidates)
  } catch (error) {
    console.warn('Snapshot media cleanup failed:', error)
  }
}

function parseAndValidateSnapshot(snapshot: InternalSnapshot, label: string): BackupData {
  let parsed: unknown
  try {
    parsed = JSON.parse(snapshot.data) as unknown
  } catch {
    throw new Error(`${label}数据无法解析`)
  }

  const validation = validateBackupData(parsed)
  if ('error' in validation) throw new Error(`${label}数据校验失败: ${validation.error}`)
  const checksum = verifyChecksum(validation.data)
  if (!checksum.valid) throw new Error(`${label}校验和不匹配`)
  return validation.data
}

// ──────────────────────── Daily Snapshots ────────────────────────

export async function createDailySnapshot(): Promise<InternalSnapshot | null> {
  const today = getLocalDateString()
  const existing = await db.snapshots
    .filter(
      (snapshot) => snapshot.id.startsWith('snap-') && toLocalDate(snapshot.createdAt) === today,
    )
    .first()
  if (existing) return null

  const data = await generateBackupData()
  const json = JSON.stringify(data)
  const validation = validateBackupData(JSON.parse(json) as unknown)
  if ('error' in validation) throw new Error(`快照验证失败：${validation.error}`)
  if (!verifyChecksum(validation.data).valid) throw new Error('快照验证失败：校验和不匹配')
  if (validation.data.manifest.entryCount !== data.entries.length) {
    throw new Error('快照验证失败：日记数量不匹配')
  }

  const snapshot: InternalSnapshot = {
    id: `snap-${today}-${Date.now()}-${uuidv4()}`,
    createdAt: new Date().toISOString(),
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    size: json.length,
    isPinned: false,
    mediaIds: referencedMediaIds(data),
    data: json,
  }

  await db.snapshots.put(snapshot)
  return snapshot
}

export async function cleanupOldSnapshots(): Promise<void> {
  const all = await db.snapshots.toArray()
  const unpinned = all
    .filter((snapshot) => !snapshot.isPinned)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const toDelete = unpinned.slice(MAX_SNAPSHOTS)
  const cleanupCandidates = new Set<string>()

  for (const snapshot of toDelete) {
    for (const mediaId of mediaIdsFromSnapshot(snapshot)) cleanupCandidates.add(mediaId)
    await db.snapshots.delete(snapshot.id)
  }
  await cleanupMediaBestEffort(cleanupCandidates)
}

export async function getSnapshots(): Promise<InternalSnapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray()
}

export async function pinSnapshot(id: string): Promise<void> {
  const snapshot = await db.snapshots.get(id)
  if (!snapshot) return
  snapshot.isPinned = !snapshot.isPinned
  await db.snapshots.put(snapshot)
}

export async function deleteSnapshot(id: string): Promise<void> {
  const snapshot = await db.snapshots.get(id)
  if (!snapshot) return
  const cleanupCandidates = mediaIdsFromSnapshot(snapshot)
  await db.snapshots.delete(id)
  await cleanupMediaBestEffort(cleanupCandidates)
}

// ──────────────────────── Restore from Snapshot ────────────────────────

/** Restore entries/tags while reusing the media Blob records retained by snapshots. */
export async function restoreFromSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.snapshots.get(snapshotId)
  if (!snapshot) throw new Error('快照不存在')

  const snapshotData = parseAndValidateSnapshot(snapshot, '快照')
  const requiredMedia = new Set([
    ...(snapshot.mediaIds ?? []),
    ...referencedMediaIds(snapshotData),
  ])
  await ensureMediaAvailable(requiredMedia, '快照')

  const safetySnapshotId = `safety-before-restore-${Date.now()}-${uuidv4()}`
  let safetySnapshot: InternalSnapshot
  try {
    const currentData = await generateBackupData()
    const serialized = JSON.stringify(currentData)
    safetySnapshot = {
      id: safetySnapshotId,
      createdAt: new Date().toISOString(),
      entryCount: currentData.manifest.entryCount,
      tagCount: currentData.manifest.tagCount,
      size: serialized.length,
      isPinned: true,
      mediaIds: referencedMediaIds(currentData),
      data: serialized,
    }
    await db.snapshots.put(safetySnapshot)
  } catch (error) {
    throw new Error(`无法创建安全快照: ${error instanceof Error ? error.message : error}`)
  }

  try {
    await db.transaction('rw', [db.entries, db.tags], async () => {
      await replaceSavedEntriesPreservingDrafts(snapshotData.entries)
      await db.tags.clear()
      for (const tag of snapshotData.tags) await db.tags.put({ name: tag })
    })

    const currentCount = await db.entries.filter((entry) => !entry.isDraft).count()
    if (currentCount !== snapshotData.manifest.entryCount) {
      throw new Error(
        `恢复后验证失败: 期望 ${snapshotData.manifest.entryCount} 条，实际 ${currentCount} 条`,
      )
    }

    let safetySnapshotDeleted = false
    try {
      await db.snapshots.delete(safetySnapshotId)
      safetySnapshotDeleted = true
    } catch (error) {
      console.warn('Safety snapshot cleanup failed:', error)
    }
    if (safetySnapshotDeleted) {
      await cleanupMediaBestEffort(safetySnapshot.mediaIds ?? [])
    }
  } catch (restoreError) {
    console.error('Snapshot restore failed:', restoreError)

    try {
      const storedSafetySnapshot = await db.snapshots.get(safetySnapshotId)
      if (!storedSafetySnapshot) throw new Error('安全快照不存在')
      const safetyData = parseAndValidateSnapshot(storedSafetySnapshot, '安全快照')
      const safetyMedia = new Set([
        ...(storedSafetySnapshot.mediaIds ?? []),
        ...referencedMediaIds(safetyData),
      ])
      await ensureMediaAvailable(safetyMedia, '安全快照')

      await db.transaction('rw', [db.entries, db.tags], async () => {
        await replaceSavedEntriesPreservingDrafts(safetyData.entries)
        await db.tags.clear()
        for (const tag of safetyData.tags) await db.tags.put({ name: tag })
      })
    } catch (rollbackError) {
      console.error('CRITICAL: safety rollback also failed!', rollbackError)
      throw new Error(
        `快照恢复失败且安全回滚也失败。请尝试从设置页面手动导入备份。错误: ${restoreError instanceof Error ? restoreError.message : restoreError}`,
      )
    }

    throw new Error(
      `快照恢复失败，数据已自动回滚到恢复前的状态。错误: ${restoreError instanceof Error ? restoreError.message : restoreError}`,
    )
  }
}
