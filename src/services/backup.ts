import JSZip from 'jszip'
import { db } from '../db/database'
import type { Entry, BackupData, BackupManifest, ExportPreview, ImportResult } from '../db/models'
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from '../db/models'
import { entryRepo } from '../db/repository'
import { getLocalDateString, toLocalDate } from '../utils/date'
import {
  validateBackupData,
  verifyChecksum,
  computeChecksum,
} from './validation'
import { v4 as uuidv4 } from '../db/uuid'

// ──────────────────────── Export ────────────────────────

export async function generateBackupData(): Promise<BackupData> {
  const entries = await db.entries.filter((e) => !e.isDraft).toArray()
  const tags = await db.tags.toCollection().toArray()
  const tagNames = tags.map((t) => t.name)

  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const earliestEntry = sorted.length > 0 ? sorted[0].createdAt : null
  const latestEntry = sorted.length > 0 ? sorted[sorted.length - 1].createdAt : null

  const manifest: BackupManifest = {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entryCount: sorted.length,
    tagCount: tagNames.length,
    earliestEntry,
    latestEntry,
    checksum: '',
  }

  const data: BackupData = { manifest, entries: sorted, tags: tagNames }
  manifest.checksum = computeChecksum(sorted, tagNames)
  data.manifest = manifest

  return data
}

export function generateMarkdown(entries: Entry[]): string {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const lines: string[] = [
    `# ${APP_NAME} — 日记备份`,
    '',
    `> 导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `> 日记数量: ${sorted.length}`,
    '',
    '---',
    '',
  ]

  let currentDate = ''
  for (const entry of sorted) {
    // Use LOCAL date for grouping, not UTC
    const date = toLocalDate(entry.createdAt)
    const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (date !== currentDate) {
      currentDate = date
      lines.push(`## ${date}`)
      lines.push('')
    }

    if (entry.title) {
      lines.push(`### ${entry.title}`)
      lines.push('')
    }

    lines.push(`*${time}*`)
    if (entry.tags.length > 0) {
      lines.push('')
      lines.push(`标签: ${entry.tags.map((t) => `\`${t}\``).join(' ')}`)
    }
    lines.push('')
    lines.push(entry.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export as a real ZIP file using JSZip.
 * Contains: backup.json, journal.md, manifest.json
 */
export async function createExportZip(): Promise<Blob> {
  const backupData = await generateBackupData()
  const journalMd = generateMarkdown(backupData.entries)
  const manifestJson = JSON.stringify(backupData.manifest, null, 2)
  const backupJson = JSON.stringify(
    { manifest: backupData.manifest, entries: backupData.entries, tags: backupData.tags },
    null,
    2,
  )

  const zip = new JSZip()
  zip.file('backup.json', backupJson)
  zip.file('journal.md', journalMd)
  zip.file('manifest.json', manifestJson)

  return zip.generateAsync({ type: 'blob' })
}

export function generateExportFilename(): string {
  const dateStr = getLocalDateString()
  const h = String(new Date().getHours()).padStart(2, '0')
  const mi = String(new Date().getMinutes()).padStart(2, '0')
  return `echo-journal-backup-${dateStr}-${h}${mi}.zip`
}

// ──────────────────────── Import / Parse ────────────────────────

/**
 * Parse an import file. Accepts:
 * 1. Real .zip files (new format)
 * 2. Legacy .json bundle format
 * 3. Raw backup.json
 *
 * Returns validated BackupData or null with error.
 */
export interface ParseResult {
  data: BackupData
  checksumValid: boolean
}

export async function parseImportFile(file: File): Promise<{ result: ParseResult } | { error: string }> {
  try {
    const buffer = await file.arrayBuffer()

    // Try ZIP first (by magic bytes: PK)
    const header = new Uint8Array(buffer.slice(0, 2))
    let backupJsonStr: string

    if (header[0] === 0x50 && header[1] === 0x4b) {
      // It's a real ZIP file
      try {
        const zip = await JSZip.loadAsync(buffer)
        const backupFile = zip.file('backup.json')
        if (!backupFile) {
          return { error: 'ZIP 中找不到 backup.json' }
        }
        backupJsonStr = await backupFile.async('string')
      } catch {
        return { error: '无法解析 ZIP 文件' }
      }
    } else {
      // Legacy: try as JSON
      const text = new TextDecoder().decode(buffer)
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(text)
      } catch {
        return { error: '无法解析文件内容，不是有效的 JSON' }
      }

      // Check if bundle format
      if (typeof parsed['backup.json'] === 'string') {
        backupJsonStr = parsed['backup.json']
      } else if (parsed.manifest && Array.isArray(parsed.entries)) {
        backupJsonStr = text
      } else {
        return { error: '不支持的文件格式' }
      }
    }

    // Parse the backup JSON
    let backupObj: unknown
    try {
      backupObj = JSON.parse(backupJsonStr)
    } catch {
      return { error: 'backup.json 不是有效的 JSON' }
    }

    // Strict runtime validation
    const validateResult = validateBackupData(backupObj)
    if ('error' in validateResult) {
      return { error: validateResult.error }
    }

    const data = validateResult.data

    // Verify checksum
    const checksumResult = verifyChecksum(data)
    if (!checksumResult.valid) {
      return {
        error: `校验和不匹配。期望: ${checksumResult.expected}，实际: ${checksumResult.actual}。备份数据可能已被修改。`,
      }
    }

    return { result: { data, checksumValid: true } }
  } catch (err) {
    return { error: `文件读取失败: ${err instanceof Error ? err.message : '未知错误'}` }
  }
}

// ──────────────────────── Preview ────────────────────────

export function previewBackup(data: BackupData): ExportPreview {
  const errors: string[] = []
  const compatible = data.manifest.schemaVersion <= SCHEMA_VERSION

  if (data.manifest.schemaVersion > SCHEMA_VERSION) {
    errors.push('备份数据版本比当前应用更新，可能不兼容')
  }

  return {
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    earliestEntry: data.manifest.earliestEntry,
    latestEntry: data.manifest.latestEntry,
    appVersion: data.manifest.appVersion,
    schemaVersion: data.manifest.schemaVersion,
    exportedAt: data.manifest.exportedAt,
    isValid: true,
    errors,
    compatible,
  }
}

// ──────────────────────── Rollback Snapshots ────────────────────────

export async function createRollbackSnapshot(): Promise<string> {
  const data = await generateBackupData()
  const snapshotId = `rollback-${Date.now()}`
  await db.snapshots.put({
    id: snapshotId,
    createdAt: new Date().toISOString(),
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    size: JSON.stringify(data).length,
    isPinned: true,
    data: JSON.stringify(data),
  })
  return snapshotId
}

async function restoreFromRollbackSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.snapshots.get(snapshotId)
  if (!snapshot) throw new Error('回滚快照不存在')

  const data = JSON.parse(snapshot.data) as BackupData

  // Clear and restore within a transaction
  await db.transaction('rw', [db.entries, db.tags], async () => {
    await db.entries.filter(() => true).delete()
    for (const entry of data.entries) {
      await db.entries.put(entry)
    }
    await db.tags.clear()
    for (const tag of data.tags || []) {
      await db.tags.put({ name: tag })
    }
  })
}

async function removeRollbackSnapshot(snapshotId: string): Promise<void> {
  try {
    await db.snapshots.delete(snapshotId)
  } catch {
    // Non-critical — snapshot cleanup is best-effort
  }
}

// ──────────────────────── Merge Import ────────────────────────

/**
 * Merge import with Dexie transaction for atomicity.
 *
 * On failure: the Dexie transaction auto-rolls back, so the database
 * remains unchanged. We also keep the rollback snapshot as an extra
 * safety net.
 */
export async function mergeImportWithRollback(
  data: BackupData,
  rollbackSnapshotId: string,
): Promise<ImportResult> {
  let added = 0
  let skipped = 0
  let updated = 0
  let conflicts = 0
  const conflictIds: string[] = []

  try {
    await db.transaction('rw', [db.entries, db.tags], async () => {
      const existingEntries = await db.entries.filter((e) => !e.isDraft).toArray()
      const existingMap = new Map(existingEntries.map((e) => [e.id, e]))

      for (const entry of data.entries) {
        const existing = existingMap.get(entry.id)

        if (!existing) {
          // New entry — import directly
          await db.entries.put(entry)
          added++
          existingMap.set(entry.id, entry) // Track for subsequent duplicates within the backup
        } else if (
          existing.content === entry.content &&
          existing.title === entry.title &&
          existing.updatedAt === entry.updatedAt
        ) {
          // Identical — skip
          skipped++
        } else if (
          new Date(entry.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
        ) {
          // Imported is newer — update
          await db.entries.put(entry)
          updated++
          existingMap.set(entry.id, entry)
        } else if (
          new Date(entry.updatedAt).getTime() < new Date(existing.updatedAt).getTime()
        ) {
          // Existing is newer — keep existing, count as conflict
          conflicts++
          conflictIds.push(entry.id)
        } else {
          // Same timestamp but different content — generate new ID for imported entry
          // to preserve BOTH versions. Silence = data loss.
          const newId = uuidv4()
          const preservedEntry: Entry = {
            ...entry,
            id: newId,
          }
          await db.entries.put(preservedEntry)
          conflicts++
          conflictIds.push(entry.id)
          added++ // Count as added since it's a new record
        }
      }

      // Merge tags
      for (const tag of data.tags || []) {
        await db.tags.put({ name: tag })
      }
    })

    // Success — remove rollback snapshot
    await removeRollbackSnapshot(rollbackSnapshotId)

    return {
      added,
      skipped,
      updated,
      conflicts,
      totalEntries: await entryRepo.getEntryCount(),
    }
  } catch (err) {
    // Transaction already rolled back by Dexie.
    // The rollback snapshot is preserved for diagnosis.
    console.error('Merge import failed, transaction rolled back:', err instanceof Error ? err.message : err)
    throw new Error(`合并导入失败，数据已保持原状。${err instanceof Error ? err.message : ''}`)
  }
}

// ──────────────────────── Replace Import ────────────────────────

/**
 * Replace import with rollback on failure.
 *
 * Flow:
 * 1. Create a rollback snapshot BEFORE touching any data
 * 2. Execute the replace inside a Dexie transaction
 * 3. If the transaction fails → automatically rolled back by Dexie
 * 4. If the transaction succeeds but post-validation fails → manual rollback
 * 5. On success → clean up the rollback snapshot
 */
export async function replaceImportWithRollback(
  data: BackupData,
  rollbackSnapshotId: string,
): Promise<void> {
  try {
    await db.transaction('rw', [db.entries, db.tags], async () => {
      // Clear all non-draft entries
      await db.entries.filter((e) => !e.isDraft).delete()

      // Import all entries from backup
      for (const entry of data.entries) {
        await db.entries.put(entry)
      }

      // Replace tags
      await db.tags.clear()
      for (const tag of data.tags || []) {
        await db.tags.put({ name: tag })
      }
    })

    // Post-transaction validation: verify data integrity
    const currentCount = await entryRepo.getEntryCount()
    if (currentCount !== data.manifest.entryCount) {
      // Something went wrong — roll back
      console.error(
        `Replace import post-validation failed: expected ${data.manifest.entryCount} entries, got ${currentCount}`,
      )

      try {
        await restoreFromRollbackSnapshot(rollbackSnapshotId)
      } catch (rollbackErr) {
        console.error('CRITICAL: rollback also failed!', rollbackErr)
        throw new Error('替换导入失败且回滚也失败，请检查内部快照手动恢复')
      }

      throw new Error('替换导入验证失败，数据已自动回滚')
    }

    // Success — clean up rollback snapshot
    await removeRollbackSnapshot(rollbackSnapshotId)
  } catch (err) {
    // If the error is from post-validation (already handled above), re-throw
    if (err instanceof Error && err.message.includes('验证失败')) {
      throw err
    }

    // Dexie transaction already rolled back.
    // But we also try the rollback snapshot as a safety net.
    console.error('Replace import failed:', err instanceof Error ? err.message : err)

    try {
      // Verify current data is still intact
      const snap = await db.snapshots.get(rollbackSnapshotId)
      if (snap) {
        await restoreFromRollbackSnapshot(rollbackSnapshotId)
        console.error('Replace import failed, rolled back to safety snapshot')
      }
    } catch (rollbackErr) {
      console.error('Rollback also failed:', rollbackErr)
    }

    throw new Error(`替换导入失败，数据已回滚。${err instanceof Error ? err.message : ''}`)
  }
}

// ──────────────────────── Legacy API (kept for snapshot restore) ────────────────────────

export async function mergeImport(data: BackupData): Promise<ImportResult> {
  const snapshotId = await createRollbackSnapshot()
  return mergeImportWithRollback(data, snapshotId)
}

export async function replaceImport(data: BackupData): Promise<void> {
  const snapshotId = await createRollbackSnapshot()
  return replaceImportWithRollback(data, snapshotId)
}
