import type { Entry, BackupData, BackupManifest } from '../db/models'
import { SCHEMA_VERSION } from '../db/models'

/**
 * Validate that an unknown JSON value is a valid Entry.
 * Returns the Entry if valid, or an error string.
 */
export function validateEntry(raw: unknown): { entry: Entry } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'entry 必须是对象' }
  }

  const e = raw as Record<string, unknown>

  if (typeof e.id !== 'string' || !e.id) {
    return { error: `entry.id 必须是有效字符串，实际: ${JSON.stringify(e.id)}` }
  }
  if (typeof e.title !== 'string') {
    return { error: `entry.title 必须是字符串: ${e.id}` }
  }
  if (typeof e.content !== 'string') {
    return { error: `entry.content 必须是字符串: ${e.id}` }
  }
  if (typeof e.createdAt !== 'string' || isNaN(Date.parse(e.createdAt))) {
    return { error: `entry.createdAt 必须是有效 ISO 日期字符串: ${e.id}` }
  }
  if (typeof e.updatedAt !== 'string' || isNaN(Date.parse(e.updatedAt))) {
    return { error: `entry.updatedAt 必须是有效 ISO 日期字符串: ${e.id}` }
  }
  if (e.isDraft !== undefined && typeof e.isDraft !== 'boolean') {
    return { error: `entry.isDraft 必须是布尔值: ${e.id}` }
  }
  if (!Array.isArray(e.tags)) {
    return { error: `entry.tags 必须是数组: ${e.id}` }
  }
  for (const tag of e.tags) {
    if (typeof tag !== 'string') {
      return { error: `entry.tags 中每个元素必须是字符串: ${e.id}` }
    }
  }

  return {
    entry: {
      id: e.id,
      title: e.title,
      content: e.content,
      tags: e.tags as string[],
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      isDraft: e.isDraft === true,
    },
  }
}

/**
 * Validate manifest fields strictly.
 */
export function validateManifest(raw: unknown): { manifest: BackupManifest } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'manifest 必须是对象' }
  }

  const m = raw as Record<string, unknown>

  if (typeof m.appName !== 'string') return { error: 'manifest.appName 必须是字符串' }
  if (typeof m.appVersion !== 'string') return { error: 'manifest.appVersion 必须是字符串' }
  if (typeof m.schemaVersion !== 'number') return { error: 'manifest.schemaVersion 必须是数字' }
  if (typeof m.exportedAt !== 'string') return { error: 'manifest.exportedAt 必须是字符串' }
  if (typeof m.entryCount !== 'number') return { error: 'manifest.entryCount 必须是数字' }
  if (typeof m.tagCount !== 'number') return { error: 'manifest.tagCount 必须是数字' }
  if (typeof m.checksum !== 'string') return { error: 'manifest.checksum 必须是字符串' }
  if (m.earliestEntry !== null && m.earliestEntry !== undefined && typeof m.earliestEntry !== 'string') {
    return { error: 'manifest.earliestEntry 必须是字符串或 null' }
  }
  if (m.latestEntry !== null && m.latestEntry !== undefined && typeof m.latestEntry !== 'string') {
    return { error: 'manifest.latestEntry 必须是字符串或 null' }
  }

  return {
    manifest: {
      appName: m.appName,
      appVersion: m.appVersion,
      schemaVersion: m.schemaVersion,
      exportedAt: m.exportedAt,
      entryCount: m.entryCount,
      tagCount: m.tagCount,
      checksum: m.checksum,
      earliestEntry: (m.earliestEntry as string) ?? null,
      latestEntry: (m.latestEntry as string) ?? null,
    },
  }
}

/**
 * Validate tags array.
 */
export function validateTags(raw: unknown): { tags: string[] } | { error: string } {
  if (!Array.isArray(raw)) {
    return { error: 'tags 必须是数组' }
  }
  for (const t of raw) {
    if (typeof t !== 'string') {
      return { error: 'tags 中每个元素必须是字符串' }
    }
  }
  return { tags: raw as string[] }
}

/**
 * Fully validate backup data with all consistency checks.
 */
export function validateBackupData(raw: unknown): { data: BackupData } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: '备份数据必须是 JSON 对象' }
  }

  const obj = raw as Record<string, unknown>

  // Validate manifest
  const manifestResult = validateManifest(obj.manifest)
  if ('error' in manifestResult) return manifestResult
  const manifest = manifestResult.manifest

  // Validate entries array
  if (!Array.isArray(obj.entries)) {
    return { error: 'entries 必须是数组' }
  }

  const entries: Entry[] = []
  for (let i = 0; i < obj.entries.length; i++) {
    const result = validateEntry(obj.entries[i])
    if ('error' in result) return { error: `entries[${i}]: ${result.error}` }
    entries.push(result.entry)
  }

  // Validate tags
  const tagsResult = validateTags(obj.tags)
  if ('error' in tagsResult) return tagsResult
  const tags = tagsResult.tags

  // Consistency check: entry count
  if (manifest.entryCount !== entries.length) {
    return {
      error: `manifest.entryCount (${manifest.entryCount}) 与 entries 数组长度 (${entries.length}) 不一致`,
    }
  }

  // Consistency check: tag count (can be <= if some tags unused)
  // But we check that the manifest tag count is reasonable
  if (manifest.tagCount > tags.length + 100) {
    // Allow some slack but flag gross inconsistency
    return {
      error: `manifest.tagCount (${manifest.tagCount}) 与 tags 数组长度 (${tags.length}) 严重不一致`,
    }
  }

  // Consistency check: schema version
  if (manifest.schemaVersion > SCHEMA_VERSION) {
    return {
      error: `备份 schema 版本 (${manifest.schemaVersion}) 高于当前应用版本 (${SCHEMA_VERSION})，无法导入`,
    }
  }

  return { data: { manifest, entries, tags } }
}

/**
 * Recompute checksum and compare.
 */
export function verifyChecksum(data: BackupData): { valid: boolean; expected: string; actual: string } {
  const actual = computeChecksum(data.entries, data.tags)
  const expected = data.manifest.checksum
  return { valid: actual === expected, expected, actual }
}

/**
 * Simple but deterministic checksum for backup data.
 */
export function computeChecksum(entries: Entry[], tags: string[]): string {
  const content = JSON.stringify({ entries, tags })
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
