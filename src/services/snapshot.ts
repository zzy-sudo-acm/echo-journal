import { db } from '../db/database'
import { generateBackupData } from './backup'
import { validateBackupData } from './validation'
import { getLocalDateString } from '../utils/date'
import type { InternalSnapshot, BackupData } from '../db/models'

const MAX_SNAPSHOTS = 7

// ──────────────────────── Daily Snapshots ────────────────────────

export async function createDailySnapshot(): Promise<InternalSnapshot | null> {
  // Use LOCAL date, not UTC
  const today = getLocalDateString()

  // Check if we already have a snapshot for today
  const existing = await db.snapshots
    .filter((s) => s.createdAt.startsWith(today))
    .first()

  if (existing) return null

  const data = await generateBackupData()

  // Validate the snapshot data can be parsed back
  const jsonStr = JSON.stringify(data)
  const reparsed = JSON.parse(jsonStr) as unknown
  const validateResult = validateBackupData(reparsed)
  if ('error' in validateResult) {
    throw new Error(`快照验证失败：${validateResult.error}`)
  }

  // Verify entry count consistency
  if (validateResult.data.manifest.entryCount !== data.entries.length) {
    throw new Error('快照验证失败：日记数量不匹配')
  }

  const snapshot: InternalSnapshot = {
    id: `snap-${today}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    size: jsonStr.length,
    isPinned: false,
    data: jsonStr,
  }

  await db.snapshots.put(snapshot)
  return snapshot
}

export async function cleanupOldSnapshots(): Promise<void> {
  const all = await db.snapshots.toArray()

  // Separate unpinned (pinned snapshots are never auto-deleted)
  const unpinned = all
    .filter((s) => !s.isPinned)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Keep only the last MAX_SNAPSHOTS unpinned snapshots
  const toDelete = unpinned.slice(MAX_SNAPSHOTS)

  for (const snap of toDelete) {
    const remaining = unpinned.filter((s) => !toDelete.find((d) => d.id === s.id))
    if (remaining.length >= MAX_SNAPSHOTS) {
      await db.snapshots.delete(snap.id)
    }
  }
}

export async function getSnapshots(): Promise<InternalSnapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray()
}

export async function pinSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id)
  if (snap) {
    snap.isPinned = !snap.isPinned
    await db.snapshots.put(snap)
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id)
}

// ──────────────────────── Restore from Snapshot ────────────────────────

/**
 * Restore from an internal snapshot WITH safety guarantees:
 *
 * 1. Validate the snapshot data before touching anything
 * 2. Create a rollback snapshot of current data
 * 3. Execute restore within a transaction
 * 4. On failure → auto-rollback via transaction + restore safety snapshot
 * 5. On success → clean up safety snapshot
 */
export async function restoreFromSnapshot(snapshotId: string): Promise<void> {
  // Step 1: Validate snapshot exists and is parsable
  const snap = await db.snapshots.get(snapshotId)
  if (!snap) throw new Error('快照不存在')

  let snapshotData: BackupData
  try {
    const parsed = JSON.parse(snap.data) as unknown
    const validateResult = validateBackupData(parsed)
    if ('error' in validateResult) {
      throw new Error(`快照数据校验失败: ${validateResult.error}`)
    }
    snapshotData = validateResult.data
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('快照数据校验失败')) {
      throw err
    }
    throw new Error('快照数据无法解析')
  }

  // Step 2: Create safety snapshot of CURRENT data
  const safetySnapshotId = `safety-before-restore-${Date.now()}`
  try {
    const currentData = await generateBackupData()
    await db.snapshots.put({
      id: safetySnapshotId,
      createdAt: new Date().toISOString(),
      entryCount: currentData.manifest.entryCount,
      tagCount: currentData.manifest.tagCount,
      size: JSON.stringify(currentData).length,
      isPinned: true,
      data: JSON.stringify(currentData),
    })
  } catch (err) {
    throw new Error(`无法创建安全快照: ${err instanceof Error ? err.message : err}`)
  }

  // Step 3: Execute restore within a transaction
  try {
    await db.transaction('rw', [db.entries, db.tags], async () => {
      // Clear all entries
      await db.entries.filter(() => true).delete()
      // Import snapshot entries
      for (const entry of snapshotData.entries) {
        await db.entries.put(entry)
      }
      // Replace tags
      await db.tags.clear()
      for (const tag of snapshotData.tags || []) {
        await db.tags.put({ name: tag })
      }
    })

    // Step 4: Post-restore validation
    const currentCount = await db.entries.count()
    if (currentCount !== snapshotData.manifest.entryCount) {
      throw new Error(
        `恢复后验证失败: 期望 ${snapshotData.manifest.entryCount} 条，实际 ${currentCount} 条`,
      )
    }

    // Step 5: Success — cleanup safety snapshot
    try {
      await db.snapshots.delete(safetySnapshotId)
    } catch {
      // Best-effort cleanup
    }
  } catch (restoreErr) {
    // Step 6: Failure — restore from safety snapshot
    console.error('Snapshot restore failed:', restoreErr instanceof Error ? restoreErr.message : restoreErr)

    try {
      const safetySnap = await db.snapshots.get(safetySnapshotId)
      if (safetySnap) {
        const safetyData = JSON.parse(safetySnap.data) as BackupData
        await db.transaction('rw', [db.entries, db.tags], async () => {
          await db.entries.filter(() => true).delete()
          for (const entry of safetyData.entries) {
            await db.entries.put(entry)
          }
          await db.tags.clear()
          for (const tag of safetyData.tags || []) {
            await db.tags.put({ name: tag })
          }
        })
      }
    } catch (rollbackErr) {
      console.error('CRITICAL: safety rollback also failed!', rollbackErr)
      throw new Error(`快照恢复失败且安全回滚也失败。请尝试从设置页面手动导入备份。错误: ${restoreErr instanceof Error ? restoreErr.message : restoreErr}`)
    }

    throw new Error(`快照恢复失败，数据已自动回滚到恢复前的状态。错误: ${restoreErr instanceof Error ? restoreErr.message : restoreErr}`)
  }
}
