import { db } from '../db/database'
import { generateBackupData } from './backup'
import type { InternalSnapshot } from '../db/models'

const MAX_SNAPSHOTS = 7

export async function createDailySnapshot(): Promise<InternalSnapshot | null> {
  const today = new Date().toISOString().slice(0, 10)

  // Check if we already have a snapshot for today
  const existing = await db.snapshots
    .filter((s) => s.createdAt.startsWith(today))
    .first()

  if (existing) return null

  const data = await generateBackupData()

  // Validate snapshot can be parsed
  const jsonStr = JSON.stringify(data)
  const reparsed = JSON.parse(jsonStr)
  if (!reparsed.manifest || !Array.isArray(reparsed.entries)) {
    throw new Error('快照验证失败：数据无法解析')
  }

  // Verify entry count
  if (reparsed.manifest.entryCount !== data.entries.length) {
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
    // Verify we have enough snapshots before deleting
    const remaining = unpinned.filter(
      (s) => !toDelete.find((d) => d.id === s.id),
    )
    if (remaining.length >= MAX_SNAPSHOTS) {
      await db.snapshots.delete(snap.id)
    }
  }
}

export async function getSnapshots(): Promise<InternalSnapshot[]> {
  return db.snapshots
    .orderBy('createdAt')
    .reverse()
    .toArray()
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

export async function restoreFromSnapshot(id: string): Promise<void> {
  const snap = await db.snapshots.get(id)
  if (!snap) throw new Error('快照不存在')

  const data = JSON.parse(snap.data)

  // Clear and restore
  await db.entries.filter(() => true).delete()
  for (const entry of data.entries) {
    await db.entries.put(entry)
  }

  await db.tags.clear()
  for (const tag of data.tags || []) {
    await db.tags.put({ name: tag })
  }
}
