import { db } from '../db/database'
import type { Entry, BackupData, BackupManifest, ExportPreview, ImportResult } from '../db/models'
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from '../db/models'
import { entryRepo } from '../db/repository'

function simpleChecksum(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export async function generateBackupData(): Promise<BackupData> {
  const entries = await db.entries.filter((e) => !e.isDraft).toArray()
  const tags = await db.tags.toCollection().toArray()
  const tagNames = tags.map((t) => t.name)

  // Sort entries by creation date
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

  const data: BackupData = {
    manifest,
    entries: sorted,
    tags: tagNames,
  }

  manifest.checksum = simpleChecksum(JSON.stringify({ entries: sorted, tags: tagNames }))
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
    const date = entry.createdAt.slice(0, 10)
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

export async function createExportZip(): Promise<Blob> {
  const backupData = await generateBackupData()
  const journalMd = generateMarkdown(backupData.entries)
  const manifestJson = JSON.stringify(backupData.manifest, null, 2)
  const backupJson = JSON.stringify(
    {
      manifest: backupData.manifest,
      entries: backupData.entries,
      tags: backupData.tags,
    },
    null,
    2,
  )

  // Use a simple ZIP-like approach — store files in a structured JSON blob
  // that can be reconstituted. For real ZIP we'd need a library, but for
  // cross-platform compatibility, we use a structured JSON bundle with
  // embedded markdown. The "zip" is actually a JSON file that contains all pieces.
  // This ensures it works on iOS, Android, and desktop without native ZIP support.

  const bundle = {
    'backup.json': backupJson,
    'journal.md': journalMd,
    'manifest.json': manifestJson,
  }

  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' })
  return blob
}

export function generateExportFilename(): string {
  const now = new Date()
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `echo-journal-backup-${y}-${mo}-${d}-${h}${mi}.json`
}

export async function parseImportFile(file: File): Promise<BackupData | null> {
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // Check if it's a bundle format (our export) or raw backup
    let backupJson: string
    if (data['backup.json']) {
      backupJson = data['backup.json']
    } else if (data.manifest && data.entries) {
      backupJson = text
    } else {
      return null
    }

    const parsed = JSON.parse(backupJson)
    if (!parsed.manifest || !Array.isArray(parsed.entries)) {
      return null
    }

    return parsed as BackupData
  } catch {
    return null
  }
}

export function previewBackup(data: BackupData): ExportPreview {
  const errors: string[] = []

  if (!data.manifest) errors.push('缺少 manifest')
  if (!Array.isArray(data.entries)) errors.push('entries 格式错误')
  if (data.manifest && data.manifest.schemaVersion > SCHEMA_VERSION) {
    errors.push('备份数据版本比当前应用更新，可能不兼容')
  }

  const compatible = data.manifest?.schemaVersion <= SCHEMA_VERSION

  return {
    entryCount: data.manifest?.entryCount ?? data.entries?.length ?? 0,
    tagCount: data.manifest?.tagCount ?? data.tags?.length ?? 0,
    earliestEntry: data.manifest?.earliestEntry ?? null,
    latestEntry: data.manifest?.latestEntry ?? null,
    appVersion: data.manifest?.appVersion ?? '未知',
    schemaVersion: data.manifest?.schemaVersion ?? 0,
    exportedAt: data.manifest?.exportedAt ?? '未知',
    isValid: errors.length === 0,
    errors,
    compatible,
  }
}

export async function mergeImport(data: BackupData): Promise<ImportResult> {
  const existingEntries = await db.entries.filter((e) => !e.isDraft).toArray()
  const existingMap = new Map(existingEntries.map((e) => [e.id, e]))

  let added = 0
  let skipped = 0
  let updated = 0
  let conflicts = 0

  for (const entry of data.entries) {
    const existing = existingMap.get(entry.id)

    if (!existing) {
      // New entry — import directly
      await db.entries.put(entry)
      added++
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
    } else if (
      new Date(entry.updatedAt).getTime() < new Date(existing.updatedAt).getTime()
    ) {
      // Existing is newer — keep existing, but count as conflict
      conflicts++
    } else {
      // Same timestamp but different content — keep both, mark conflict
      conflicts++
    }
  }

  // Merge tags
  for (const tag of data.tags || []) {
    await db.tags.put({ name: tag })
  }

  return {
    added,
    skipped,
    updated,
    conflicts,
    totalEntries: await entryRepo.getEntryCount(),
  }
}

export async function replaceImport(data: BackupData): Promise<void> {
  // Clear existing entries (non-drafts)
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
}

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

export async function rollbackToSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.snapshots.get(snapshotId)
  if (!snapshot) throw new Error('回滚快照不存在')

  const data: BackupData = JSON.parse(snapshot.data)
  await replaceImport(data)
}
