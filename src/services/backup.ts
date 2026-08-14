import JSZip from 'jszip'
import { db } from '../db/database'
import type {
  BackupData,
  BackupManifest,
  BackupMediaMetadata,
  Entry,
  ExportPreview,
  ImportResult,
  JournalMedia,
  ParsedBackup,
} from '../db/models'
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from '../db/models'
import { cleanupOrphanMedia } from '../db/repository'
import { v4 as uuidv4 } from '../db/uuid'
import { getLocalDateString, toLocalDate } from '../utils/date'
import { collectMediaIds, rewriteMediaIds } from './richContent'
import {
  computeChecksum,
  validateBackupData,
  validateManifest,
  verifyChecksum,
} from './validation'

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

interface BackupBundle {
  data: BackupData
  mediaById: Map<string, JournalMedia>
}

interface PreparedImport {
  data: BackupData
  entries: Entry[]
  mediaToInsert: JournalMedia[]
  reusedMediaIds: string[]
  cleanupCandidates: Set<string>
}

export type ParseResult = ParsedBackup
type ImportSource = BackupData | ParsedBackup

function mediaIdsForEntries(entries: Entry[]): string[] {
  const ids = new Set<string>()
  for (const entry of entries) {
    for (const mediaId of collectMediaIds(entry.richContent)) ids.add(mediaId)
  }
  return [...ids]
}

function fileExtensionForMime(mimeType: string): string {
  const known = MIME_EXTENSIONS[mimeType.toLowerCase()]
  if (known) return known

  const subtype = mimeType.toLowerCase().split('/')[1]?.split('+')[0] ?? ''
  const safeSubtype = subtype.replace(/[^a-z0-9]/g, '')
  if (!mimeType.toLowerCase().startsWith('image/') || !safeSubtype) {
    throw new Error(`不支持的图片类型: ${mimeType || '未知'}`)
  }
  return safeSubtype
}

async function sha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持 SHA-256，无法安全处理备份')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function buildBackupBundle(): Promise<BackupBundle> {
  const entries = await db.entries.filter((entry) => !entry.isDraft).toArray()
  const tags = await db.tags.toCollection().toArray()
  const tagNames = tags.map((tag) => tag.name)
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  const mediaIds = mediaIdsForEntries(sortedEntries).sort((a, b) => a.localeCompare(b))
  const mediaRecords = await db.media.bulkGet(mediaIds)
  const mediaById = new Map<string, JournalMedia>()

  for (let i = 0; i < mediaIds.length; i++) {
    const record = mediaRecords[i]
    if (!record) throw new Error(`日记引用的图片不存在，无法导出: ${mediaIds[i]}`)
    if (!(record.blob instanceof Blob) || record.blob.size <= 0) {
      throw new Error(`图片数据损坏，无法导出: ${record.id}`)
    }
    if (!Number.isInteger(record.width) || record.width <= 0 || !Number.isInteger(record.height) || record.height <= 0) {
      throw new Error(`图片尺寸无效，无法导出: ${record.id}`)
    }
    mediaById.set(record.id, record)
  }

  const media: BackupMediaMetadata[] = []
  // Hash sequentially to avoid holding many decoded phone-photo buffers in memory at once.
  for (const mediaId of mediaIds) {
    const record = mediaById.get(mediaId)
    if (!record) throw new Error(`图片不存在，无法导出: ${mediaId}`)
    media.push({
      id: record.id,
      path: `media/${record.id}.${fileExtensionForMime(record.mimeType)}`,
      mimeType: record.mimeType,
      width: record.width,
      height: record.height,
      byteSize: record.blob.size,
      sha256: await sha256(record.blob),
      ...(record.fileName ? { fileName: record.fileName } : {}),
      createdAt: record.createdAt,
    })
  }

  const earliestEntry = sortedEntries.length > 0 ? sortedEntries[0].createdAt : null
  const latestEntry = sortedEntries.length > 0
    ? sortedEntries[sortedEntries.length - 1].createdAt
    : null

  const manifest: BackupManifest = {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entryCount: sortedEntries.length,
    tagCount: tagNames.length,
    mediaCount: media.length,
    earliestEntry,
    latestEntry,
    checksum: '',
  }

  const data: BackupData = {
    manifest,
    entries: sortedEntries,
    tags: tagNames,
    media,
  }
  manifest.checksum = computeChecksum(sortedEntries, tagNames, media)

  return { data, mediaById }
}

// ──────────────────────── Export ────────────────────────

export async function generateBackupData(): Promise<BackupData> {
  return (await buildBackupBundle()).data
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
    const date = toLocalDate(entry.createdAt)
    const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    if (date !== currentDate) {
      currentDate = date
      lines.push(`## ${date}`, '')
    }

    if (entry.title) lines.push(`### ${entry.title}`, '')
    lines.push(`*${time}*`)
    if (entry.tags.length > 0) {
      lines.push('', `标签: ${entry.tags.map((tag) => `\`${tag}\``).join(' ')}`)
    }
    lines.push('', entry.content, '', '---', '')
  }

  return lines.join('\n')
}

/** Create a self-contained schema v3 ZIP, including actual image binaries. */
export async function createExportZip(): Promise<Blob> {
  const { data, mediaById } = await buildBackupBundle()
  const activeEntries = data.entries.filter((entry) => !entry.deletedAt)
  const zip = new JSZip()

  zip.file('backup.json', JSON.stringify(data, null, 2))
  zip.file('manifest.json', JSON.stringify(data.manifest, null, 2))
  zip.file('journal.md', generateMarkdown(activeEntries))

  for (const metadata of data.media ?? []) {
    const record = mediaById.get(metadata.id)
    if (!record) throw new Error(`图片不存在，无法写入备份: ${metadata.id}`)
    // Processed images are already compressed; STORE avoids wasteful recompression on mobile.
    zip.file(metadata.path, record.blob, { binary: true, compression: 'STORE' })
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

export function generateExportFilename(): string {
  const dateStr = getLocalDateString()
  const hours = String(new Date().getHours()).padStart(2, '0')
  const minutes = String(new Date().getMinutes()).padStart(2, '0')
  return `echo-journal-backup-${dateStr}-${hours}${minutes}.zip`
}

// ──────────────────────── Import / Parse ────────────────────────

function parseJson(text: string, message: string): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(text) as unknown }
  } catch {
    return { error: message }
  }
}

function manifestsMatch(left: BackupManifest, right: BackupManifest): boolean {
  return (
    left.appName === right.appName &&
    left.appVersion === right.appVersion &&
    left.schemaVersion === right.schemaVersion &&
    left.exportedAt === right.exportedAt &&
    left.entryCount === right.entryCount &&
    left.tagCount === right.tagCount &&
    (left.mediaCount ?? 0) === (right.mediaCount ?? 0) &&
    left.earliestEntry === right.earliestEntry &&
    left.latestEntry === right.latestEntry &&
    left.checksum === right.checksum
  )
}

async function parseArchiveMedia(
  zip: JSZip,
  data: BackupData,
): Promise<{ media: JournalMedia[] } | { error: string }> {
  const metadata = data.media ?? []
  const expectedPaths = new Set(metadata.map((item) => item.path))
  const archivedPaths = Object.values(zip.files)
    .filter((item) => !item.dir && item.name.startsWith('media/'))
    .map((item) => item.name)

  for (const archivedPath of archivedPaths) {
    if (!expectedPaths.has(archivedPath)) {
      return { error: `ZIP 包含未登记的媒体文件: ${archivedPath}` }
    }
  }
  if (archivedPaths.length !== expectedPaths.size) {
    return { error: 'ZIP 中的媒体文件数量与 backup.json 不一致' }
  }

  try {
    const media: JournalMedia[] = []
    // Decompress and hash one file at a time to cap transient ArrayBuffer usage.
    for (const item of metadata) {
      const archiveFile = zip.file(item.path)
      if (!archiveFile) throw new Error(`ZIP 中找不到图片文件: ${item.path}`)

      const bytes = await archiveFile.async('uint8array')
      if (bytes.byteLength !== item.byteSize) {
        throw new Error(`图片大小校验失败: ${item.id}`)
      }

      // JSZip returns an ArrayBuffer-backed view in browsers; pass it directly
      // so large imports do not briefly hold a second full copy of each image.
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: item.mimeType })
      const actualHash = await sha256(blob)
      if (actualHash !== item.sha256.toLowerCase()) {
        throw new Error(`图片 SHA-256 校验失败: ${item.id}`)
      }

      media.push({
        id: item.id,
        blob,
        mimeType: item.mimeType,
        width: item.width as number,
        height: item.height as number,
        ...(item.fileName ? { fileName: item.fileName } : {}),
        createdAt: item.createdAt ?? data.manifest.exportedAt,
      })
    }
    return { media }
  } catch (error) {
    return { error: error instanceof Error ? error.message : '媒体文件读取失败' }
  }
}

/** Parse a real ZIP or a legacy schema v1/v2 JSON backup. */
export async function parseImportFile(
  file: File,
): Promise<{ result: ParseResult } | { error: string }> {
  try {
    const buffer = await file.arrayBuffer()
    const header = new Uint8Array(buffer.slice(0, 2))
    const isZip = header[0] === 0x50 && header[1] === 0x4b
    let zip: JSZip | null = null
    let backupJsonText = ''

    if (isZip) {
      try {
        zip = await JSZip.loadAsync(buffer)
      } catch {
        return { error: '无法解析 ZIP 文件' }
      }
      const backupFile = zip.file('backup.json')
      if (!backupFile) return { error: 'ZIP 中找不到 backup.json' }
      backupJsonText = await backupFile.async('string')
    } else {
      const text = new TextDecoder().decode(buffer)
      const parsedResult = parseJson(text, '无法解析文件内容，不是有效的 JSON')
      if ('error' in parsedResult) return parsedResult
      if (!parsedResult.value || typeof parsedResult.value !== 'object') {
        return { error: '不支持的文件格式' }
      }

      const parsed = parsedResult.value as Record<string, unknown>
      if (typeof parsed['backup.json'] === 'string') {
        backupJsonText = parsed['backup.json']
      } else if (parsed.manifest && Array.isArray(parsed.entries)) {
        backupJsonText = text
      } else {
        return { error: '不支持的文件格式' }
      }
    }

    const backupJsonResult = parseJson(backupJsonText, 'backup.json 不是有效的 JSON')
    if ('error' in backupJsonResult) return backupJsonResult
    const validateResult = validateBackupData(backupJsonResult.value)
    if ('error' in validateResult) return validateResult
    const data = validateResult.data

    const checksumResult = verifyChecksum(data)
    if (!checksumResult.valid) {
      return {
        error: `校验和不匹配。期望: ${checksumResult.expected}，实际: ${checksumResult.actual}。备份数据可能已被修改。`,
      }
    }

    if (data.manifest.schemaVersion < 3) {
      return { result: { data, media: [], checksumValid: true } }
    }
    if (!zip) {
      if ((data.manifest.mediaCount ?? 0) > 0 || mediaIdsForEntries(data.entries).length > 0) {
        return { error: '包含图片的 schema v3 备份必须使用自包含 ZIP 格式' }
      }
      return { result: { data, media: [], checksumValid: true } }
    }

    const manifestFile = zip.file('manifest.json')
    const journalFile = zip.file('journal.md')
    if (!manifestFile) return { error: 'ZIP 中找不到 manifest.json' }
    if (!journalFile) return { error: 'ZIP 中找不到 journal.md' }

    const manifestJsonResult = parseJson(
      await manifestFile.async('string'),
      'manifest.json 不是有效的 JSON',
    )
    if ('error' in manifestJsonResult) return manifestJsonResult
    const manifestResult = validateManifest(manifestJsonResult.value)
    if ('error' in manifestResult) return manifestResult
    if (!manifestsMatch(data.manifest, manifestResult.manifest)) {
      return { error: 'manifest.json 与 backup.json 中的 manifest 不一致' }
    }

    const mediaResult = await parseArchiveMedia(zip, data)
    if ('error' in mediaResult) return mediaResult

    const binaryIds = new Set(mediaResult.media.map((item) => item.id))
    for (const mediaId of mediaIdsForEntries(data.entries)) {
      if (!binaryIds.has(mediaId)) {
        return { error: `富文本引用的图片文件缺失: ${mediaId}` }
      }
    }

    return { result: { data, media: mediaResult.media, checksumValid: true } }
  } catch (error) {
    return { error: `文件读取失败: ${error instanceof Error ? error.message : '未知错误'}` }
  }
}

// ──────────────────────── Preview ────────────────────────

export function previewBackup(data: BackupData): ExportPreview {
  const errors: string[] = []
  const compatible = data.manifest.schemaVersion <= SCHEMA_VERSION
  if (!compatible) errors.push('备份数据版本比当前应用更新，可能不兼容')

  return {
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    mediaCount: data.manifest.mediaCount ?? data.media?.length ?? 0,
    activeEntryCount: data.entries.filter((entry) => !entry.deletedAt).length,
    trashEntryCount: data.entries.filter((entry) => Boolean(entry.deletedAt)).length,
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

// ──────────────────────── Snapshot Helpers ────────────────────────

function normalizedImport(source: ImportSource): ParsedBackup {
  if ('data' in source) {
    if (!source.checksumValid) throw new Error('备份校验和未通过，已拒绝导入')
    return source
  }
  return { data: source, media: [], checksumValid: true }
}

function snapshotMediaIds(data: BackupData): string[] {
  return mediaIdsForEntries(data.entries)
}

function reserveUuid(reservedIds: Set<string>): string {
  let id = uuidv4()
  while (reservedIds.has(id)) id = uuidv4()
  reservedIds.add(id)
  return id
}

/** Replace saved entries without deleting or overwriting an in-progress draft entry. */
async function replaceSavedEntriesPreservingDrafts(entries: Entry[]): Promise<void> {
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

async function ensureMediaExists(mediaIds: Iterable<string>, context: string): Promise<void> {
  const ids = [...new Set(mediaIds)]
  if (ids.length === 0) return
  const records = await db.media.bulkGet(ids)
  const missing = ids.filter((_, index) => !records[index])
  if (missing.length > 0) {
    throw new Error(`${context}引用的图片不存在: ${missing.join(', ')}`)
  }
}

export async function createRollbackSnapshot(): Promise<string> {
  const data = await generateBackupData()
  const serialized = JSON.stringify(data)
  const snapshotId = `rollback-${Date.now()}-${uuidv4()}`
  await db.snapshots.put({
    id: snapshotId,
    createdAt: new Date().toISOString(),
    entryCount: data.manifest.entryCount,
    tagCount: data.manifest.tagCount,
    size: serialized.length,
    isPinned: true,
    mediaIds: snapshotMediaIds(data),
    data: serialized,
  })
  return snapshotId
}

async function restoreFromRollbackSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.snapshots.get(snapshotId)
  if (!snapshot) throw new Error('回滚快照不存在')

  const parsed = parseJson(snapshot.data, '回滚快照无法解析')
  if ('error' in parsed) throw new Error(parsed.error)
  const validated = validateBackupData(parsed.value)
  if ('error' in validated) throw new Error(`回滚快照校验失败: ${validated.error}`)
  const checksum = verifyChecksum(validated.data)
  if (!checksum.valid) throw new Error('回滚快照校验和不匹配')

  const requiredMedia = new Set([
    ...(snapshot.mediaIds ?? []),
    ...snapshotMediaIds(validated.data),
  ])
  await ensureMediaExists(requiredMedia, '回滚快照')

  await db.transaction('rw', [db.entries, db.tags], async () => {
    await replaceSavedEntriesPreservingDrafts(validated.data.entries)
    await db.tags.clear()
    for (const tag of validated.data.tags) await db.tags.put({ name: tag })
  })
}

async function removeRollbackSnapshot(snapshotId: string): Promise<string[]> {
  try {
    const snapshot = await db.snapshots.get(snapshotId)
    await db.snapshots.delete(snapshotId)
    if (!snapshot) return []
    if (snapshot.mediaIds) return snapshot.mediaIds
    const parsed = JSON.parse(snapshot.data) as BackupData
    return snapshotMediaIds(parsed)
  } catch {
    return []
  }
}

async function cleanupMediaBestEffort(mediaIds: Iterable<string>): Promise<void> {
  const candidates = [...new Set(mediaIds)]
  if (candidates.length === 0) return
  try {
    await cleanupOrphanMedia(candidates)
  } catch (error) {
    console.warn('Orphan media cleanup failed:', error)
  }
}

// ──────────────────────── Media Conflict Planning ────────────────────────

async function uniqueMediaId(reserved: Set<string>): Promise<string> {
  let id = uuidv4()
  while (reserved.has(id) || await db.media.get(id)) id = uuidv4()
  reserved.add(id)
  return id
}

async function prepareImport(source: ImportSource): Promise<PreparedImport> {
  const parsed = normalizedImport(source)
  const data = parsed.data
  const metadata = data.media ?? []

  const entryIds = new Set<string>()
  for (const entry of data.entries) {
    if (entry.isDraft) throw new Error('备份中不能包含草稿记录')
    if (entryIds.has(entry.id)) throw new Error(`备份包含重复日记 ID: ${entry.id}`)
    entryIds.add(entry.id)
  }

  if (data.manifest.schemaVersion >= 3 && parsed.media.length !== metadata.length) {
    throw new Error('导入图片文件数量与 metadata 不一致')
  }

  const metadataById = new Map(metadata.map((item) => [item.id, item]))
  const importedById = new Map<string, JournalMedia>()
  for (const record of parsed.media) {
    if (importedById.has(record.id)) throw new Error(`导入包含重复媒体 ID: ${record.id}`)
    const item = metadataById.get(record.id)
    if (!item) throw new Error(`导入图片缺少 metadata: ${record.id}`)
    if (!(record.blob instanceof Blob) || record.blob.size !== item.byteSize) {
      throw new Error(`导入图片大小校验失败: ${record.id}`)
    }
    const hash = await sha256(record.blob)
    if (hash !== item.sha256.toLowerCase()) throw new Error(`导入图片 SHA-256 校验失败: ${record.id}`)
    importedById.set(record.id, record)
  }

  const referencedIds = mediaIdsForEntries(data.entries)
  for (const mediaId of referencedIds) {
    if (!importedById.has(mediaId)) throw new Error(`富文本引用的导入图片不存在: ${mediaId}`)
  }

  const relevantMedia = referencedIds
    .map((mediaId) => importedById.get(mediaId))
    .filter((record): record is JournalMedia => Boolean(record))
  const existing = await db.media.bulkGet(relevantMedia.map((record) => record.id))
  const reserved = new Set(relevantMedia.map((record) => record.id))
  const idMap = new Map<string, string>()
  const mediaToInsert: JournalMedia[] = []
  const reusedMediaIds: string[] = []
  const cleanupCandidates = new Set<string>(relevantMedia.map((record) => record.id))

  for (let i = 0; i < relevantMedia.length; i++) {
    const imported = relevantMedia[i]
    const current = existing[i]
    if (!current) {
      mediaToInsert.push(imported)
      continue
    }

    const item = metadataById.get(imported.id)
    if (!item) throw new Error(`导入图片缺少 metadata: ${imported.id}`)
    let sameBinary = false
    if (
      current.blob instanceof Blob &&
      current.blob.size === imported.blob.size &&
      current.mimeType === imported.mimeType &&
      current.width === imported.width &&
      current.height === imported.height
    ) {
      try {
        sameBinary = await sha256(current.blob) === item.sha256.toLowerCase()
      } catch {
        sameBinary = false
      }
    }

    if (sameBinary) {
      reusedMediaIds.push(imported.id)
      continue
    }

    const replacementId = await uniqueMediaId(reserved)
    idMap.set(imported.id, replacementId)
    cleanupCandidates.add(replacementId)
    mediaToInsert.push({ ...imported, id: replacementId })
  }

  const entries = idMap.size === 0
    ? data.entries
    : data.entries.map((entry) => ({
        ...entry,
        richContent: rewriteMediaIds(entry.richContent, idMap),
      }))

  return { data, entries, mediaToInsert, reusedMediaIds, cleanupCandidates }
}

function entriesAreIdentical(left: Entry, right: Entry): boolean {
  return (
    left.title === right.title &&
    left.content === right.content &&
    JSON.stringify(left.richContent ?? null) === JSON.stringify(right.richContent ?? null) &&
    JSON.stringify(left.tags) === JSON.stringify(right.tags) &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.isDraft === right.isDraft &&
    left.deletedAt === right.deletedAt
  )
}

// ──────────────────────── Merge Import ────────────────────────

export async function mergeImportWithRollback(
  source: ImportSource,
  rollbackSnapshotId: string,
): Promise<ImportResult> {
  let added = 0
  let skipped = 0
  let updated = 0
  let conflicts = 0
  let totalEntries = 0
  const prepared = await prepareImport(source)

  try {
    await db.transaction('rw', [db.entries, db.tags, db.media], async () => {
      for (const mediaId of prepared.reusedMediaIds) {
        if (!await db.media.get(mediaId)) throw new Error(`可复用图片已不存在: ${mediaId}`)
      }
      for (const media of prepared.mediaToInsert) await db.media.add(media)

      const existingEntries = await db.entries.toArray()
      const existingMap = new Map(existingEntries.map((entry) => [entry.id, entry]))
      const reservedEntryIds = new Set([
        ...existingEntries.map((entry) => entry.id),
        ...prepared.entries.map((entry) => entry.id),
      ])

      for (const entry of prepared.entries) {
        const existing = existingMap.get(entry.id)
        if (!existing) {
          await db.entries.add(entry)
          existingMap.set(entry.id, entry)
          added++
        } else if (existing.isDraft) {
          const preservedEntry = { ...entry, id: reserveUuid(reservedEntryIds) }
          await db.entries.add(preservedEntry)
          existingMap.set(preservedEntry.id, preservedEntry)
          conflicts++
          added++
        } else if (entriesAreIdentical(existing, entry)) {
          skipped++
        } else if (new Date(entry.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          await db.entries.put(entry)
          existingMap.set(entry.id, entry)
          updated++
        } else if (new Date(entry.updatedAt).getTime() < new Date(existing.updatedAt).getTime()) {
          conflicts++
        } else {
          const preservedEntry = { ...entry, id: reserveUuid(reservedEntryIds) }
          await db.entries.add(preservedEntry)
          existingMap.set(preservedEntry.id, preservedEntry)
          conflicts++
          added++
        }
      }

      for (const tag of prepared.data.tags) await db.tags.put({ name: tag })
      totalEntries = await db.entries.filter((entry) => !entry.isDraft).count()
    })

    const releasedMedia = await removeRollbackSnapshot(rollbackSnapshotId)
    await cleanupMediaBestEffort([...releasedMedia, ...prepared.cleanupCandidates])

    return {
      added,
      skipped,
      updated,
      conflicts,
      totalEntries,
    }
  } catch (error) {
    console.error('Merge import failed, transaction rolled back:', error)
    throw new Error(`合并导入失败，数据已保持原状。${error instanceof Error ? error.message : ''}`)
  }
}

// ──────────────────────── Replace Import ────────────────────────

export async function replaceImportWithRollback(
  source: ImportSource,
  rollbackSnapshotId: string,
): Promise<void> {
  const prepared = await prepareImport(source)
  let transactionAttempted = false

  try {
    transactionAttempted = true
    await db.transaction('rw', [db.entries, db.tags, db.media], async () => {
      for (const mediaId of prepared.reusedMediaIds) {
        if (!await db.media.get(mediaId)) throw new Error(`可复用图片已不存在: ${mediaId}`)
      }
      for (const media of prepared.mediaToInsert) await db.media.add(media)
      await replaceSavedEntriesPreservingDrafts(prepared.entries)
      await db.tags.clear()
      for (const tag of prepared.data.tags) await db.tags.put({ name: tag })
    })

    const currentCount = await db.entries.filter((entry) => !entry.isDraft).count()
    if (currentCount !== prepared.data.manifest.entryCount) {
      throw new Error(
        `替换导入验证失败: 期望 ${prepared.data.manifest.entryCount} 条，实际 ${currentCount} 条`,
      )
    }

    const releasedMedia = await removeRollbackSnapshot(rollbackSnapshotId)
    await cleanupMediaBestEffort([...releasedMedia, ...prepared.cleanupCandidates])
  } catch (error) {
    console.error('Replace import failed:', error)
    if (transactionAttempted) {
      try {
        await restoreFromRollbackSnapshot(rollbackSnapshotId)
      } catch (rollbackError) {
        console.error('CRITICAL: rollback also failed!', rollbackError)
        throw new Error('替换导入失败且回滚也失败，请检查内部快照手动恢复')
      }
    }
    await cleanupMediaBestEffort(prepared.cleanupCandidates)
    throw new Error(`替换导入失败，数据已回滚。${error instanceof Error ? error.message : ''}`)
  }
}

// ──────────────────────── Legacy API ────────────────────────

export async function mergeImport(source: ImportSource): Promise<ImportResult> {
  const snapshotId = await createRollbackSnapshot()
  return mergeImportWithRollback(source, snapshotId)
}

export async function replaceImport(source: ImportSource): Promise<void> {
  const snapshotId = await createRollbackSnapshot()
  return replaceImportWithRollback(source, snapshotId)
}
