import type {
  BackupData,
  BackupManifest,
  BackupMediaMetadata,
  Entry,
  RichContent,
} from '../db/models'
import { SCHEMA_VERSION } from '../db/models'
import { collectMediaIds } from './richContent'

const MEDIA_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const MEDIA_PATH_PATTERN = /^media\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.[A-Za-z0-9]+$/
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/
const MAX_RICH_CONTENT_DEPTH = 100
const MAX_RICH_CONTENT_NODES = 100_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validateJsonValue(value: unknown, path: string, depth = 0): string | null {
  if (depth > MAX_RICH_CONTENT_DEPTH) return `${path} 嵌套层级过深`
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : `${path} 包含无效数字`
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const error = validateJsonValue(value[i], `${path}[${i}]`, depth + 1)
      if (error) return error
    }
    return null
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const error = validateJsonValue(child, `${path}.${key}`, depth + 1)
      if (error) return error
    }
    return null
  }
  return `${path} 包含不可序列化的数据`
}

function validateRichContent(raw: unknown, entryId: string): { content: RichContent } | { error: string } {
  if (!isRecord(raw) || raw.type !== 'doc') {
    return { error: `entry.richContent 必须是 Tiptap doc 对象: ${entryId}` }
  }

  let nodeCount = 0
  const visit = (nodeRaw: unknown, path: string, depth: number): string | null => {
    if (depth > MAX_RICH_CONTENT_DEPTH) return `${path} 嵌套层级过深`
    if (!isRecord(nodeRaw) || typeof nodeRaw.type !== 'string' || !nodeRaw.type) {
      return `${path}.type 必须是有效字符串`
    }

    nodeCount++
    if (nodeCount > MAX_RICH_CONTENT_NODES) return 'entry.richContent 节点数量过多'

    if (nodeRaw.text !== undefined && typeof nodeRaw.text !== 'string') {
      return `${path}.text 必须是字符串`
    }

    if (nodeRaw.attrs !== undefined) {
      if (!isRecord(nodeRaw.attrs)) return `${path}.attrs 必须是对象`
      const attrsError = validateJsonValue(nodeRaw.attrs, `${path}.attrs`)
      if (attrsError) return attrsError

      const mediaId = nodeRaw.attrs.mediaId
      if (mediaId !== undefined && (typeof mediaId !== 'string' || !MEDIA_ID_PATTERN.test(mediaId))) {
        return `${path}.attrs.mediaId 必须是有效媒体 ID`
      }
      const src = nodeRaw.attrs.src
      if (typeof src === 'string') {
        return `${path}.attrs.src 不允许持久化，图片必须使用本地 mediaId`
      }
    }

    if (nodeRaw.type === 'image') {
      return `${path} 使用了非本地 image 节点，请改用 localImage`
    }
    if (nodeRaw.type === 'localImage') {
      const mediaId = isRecord(nodeRaw.attrs) ? nodeRaw.attrs.mediaId : undefined
      if (typeof mediaId !== 'string' || !mediaId) {
        return `${path} 本地图片缺少 mediaId`
      }
    }

    if (nodeRaw.marks !== undefined) {
      if (!Array.isArray(nodeRaw.marks)) return `${path}.marks 必须是数组`
      for (let i = 0; i < nodeRaw.marks.length; i++) {
        const mark = nodeRaw.marks[i]
        if (!isRecord(mark) || typeof mark.type !== 'string' || !mark.type) {
          return `${path}.marks[${i}] 必须包含有效 type`
        }
        if (mark.attrs !== undefined) {
          if (!isRecord(mark.attrs)) return `${path}.marks[${i}].attrs 必须是对象`
          const markError = validateJsonValue(mark.attrs, `${path}.marks[${i}].attrs`)
          if (markError) return markError
        }
      }
    }

    if (nodeRaw.content !== undefined) {
      if (!Array.isArray(nodeRaw.content)) return `${path}.content 必须是数组`
      for (let i = 0; i < nodeRaw.content.length; i++) {
        const childError = visit(nodeRaw.content[i], `${path}.content[${i}]`, depth + 1)
        if (childError) return childError
      }
    }

    return null
  }

  const error = visit(raw, 'entry.richContent', 0)
  return error ? { error: `${error}: ${entryId}` } : { content: raw as RichContent }
}

/** Validate an unknown JSON value as a complete journal entry. */
export function validateEntry(raw: unknown): { entry: Entry } | { error: string } {
  if (!isRecord(raw)) return { error: 'entry 必须是对象' }
  const e = raw

  if (typeof e.id !== 'string' || !e.id) {
    return { error: `entry.id 必须是有效字符串，实际: ${JSON.stringify(e.id)}` }
  }
  if (typeof e.title !== 'string') return { error: `entry.title 必须是字符串: ${e.id}` }
  if (typeof e.content !== 'string') return { error: `entry.content 必须是字符串: ${e.id}` }
  if (typeof e.createdAt !== 'string' || Number.isNaN(Date.parse(e.createdAt))) {
    return { error: `entry.createdAt 必须是有效 ISO 日期字符串: ${e.id}` }
  }
  if (typeof e.updatedAt !== 'string' || Number.isNaN(Date.parse(e.updatedAt))) {
    return { error: `entry.updatedAt 必须是有效 ISO 日期字符串: ${e.id}` }
  }
  if (e.isDraft !== undefined && typeof e.isDraft !== 'boolean') {
    return { error: `entry.isDraft 必须是布尔值: ${e.id}` }
  }
  if (e.deletedAt !== undefined && e.deletedAt !== null && typeof e.deletedAt !== 'string') {
    return { error: `entry.deletedAt 必须是字符串或不存在: ${e.id}` }
  }
  if (typeof e.deletedAt === 'string' && Number.isNaN(Date.parse(e.deletedAt))) {
    return { error: `entry.deletedAt 必须是有效 ISO 日期字符串: ${e.id}` }
  }
  if (!Array.isArray(e.tags)) return { error: `entry.tags 必须是数组: ${e.id}` }
  for (const tag of e.tags) {
    if (typeof tag !== 'string') {
      return { error: `entry.tags 中每个元素必须是字符串: ${e.id}` }
    }
  }

  let richContent: RichContent | undefined
  if (e.richContent !== undefined && e.richContent !== null) {
    const richResult = validateRichContent(e.richContent, e.id)
    if ('error' in richResult) return richResult
    richContent = richResult.content
  }

  return {
    entry: {
      id: e.id,
      title: e.title,
      content: e.content,
      ...(richContent ? { richContent } : {}),
      tags: e.tags as string[],
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      isDraft: e.isDraft === true,
      ...(typeof e.deletedAt === 'string' ? { deletedAt: e.deletedAt } : {}),
    },
  }
}

/** Validate manifest fields, while normalizing legacy mediaCount to zero. */
export function validateManifest(raw: unknown): { manifest: BackupManifest } | { error: string } {
  if (!isRecord(raw)) return { error: 'manifest 必须是对象' }
  const m = raw

  if (typeof m.appName !== 'string') return { error: 'manifest.appName 必须是字符串' }
  if (typeof m.appVersion !== 'string') return { error: 'manifest.appVersion 必须是字符串' }
  if (!Number.isInteger(m.schemaVersion) || (m.schemaVersion as number) < 1) {
    return { error: 'manifest.schemaVersion 必须是正整数' }
  }
  if (typeof m.exportedAt !== 'string') return { error: 'manifest.exportedAt 必须是字符串' }
  if (!Number.isInteger(m.entryCount) || (m.entryCount as number) < 0) {
    return { error: 'manifest.entryCount 必须是非负整数' }
  }
  if (!Number.isInteger(m.tagCount) || (m.tagCount as number) < 0) {
    return { error: 'manifest.tagCount 必须是非负整数' }
  }
  if (typeof m.checksum !== 'string') return { error: 'manifest.checksum 必须是字符串' }
  if (m.earliestEntry !== null && m.earliestEntry !== undefined && typeof m.earliestEntry !== 'string') {
    return { error: 'manifest.earliestEntry 必须是字符串或 null' }
  }
  if (m.latestEntry !== null && m.latestEntry !== undefined && typeof m.latestEntry !== 'string') {
    return { error: 'manifest.latestEntry 必须是字符串或 null' }
  }

  const schemaVersion = m.schemaVersion as number
  if (schemaVersion >= 3) {
    if (!Number.isInteger(m.mediaCount) || (m.mediaCount as number) < 0) {
      return { error: 'manifest.mediaCount 必须是非负整数' }
    }
  } else if (
    m.mediaCount !== undefined &&
    (!Number.isInteger(m.mediaCount) || (m.mediaCount as number) < 0)
  ) {
    return { error: 'manifest.mediaCount 必须是非负整数' }
  }

  return {
    manifest: {
      appName: m.appName,
      appVersion: m.appVersion,
      schemaVersion,
      exportedAt: m.exportedAt,
      entryCount: m.entryCount as number,
      tagCount: m.tagCount as number,
      mediaCount: typeof m.mediaCount === 'number' ? m.mediaCount : 0,
      checksum: m.checksum,
      earliestEntry: (m.earliestEntry as string | null | undefined) ?? null,
      latestEntry: (m.latestEntry as string | null | undefined) ?? null,
    },
  }
}

export function validateTags(raw: unknown): { tags: string[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'tags 必须是数组' }
  for (const tag of raw) {
    if (typeof tag !== 'string') return { error: 'tags 中每个元素必须是字符串' }
  }
  return { tags: raw as string[] }
}

function validateMediaMetadata(
  raw: unknown,
  index: number,
): { media: BackupMediaMetadata } | { error: string } {
  if (!isRecord(raw)) return { error: `media[${index}] 必须是对象` }
  if (typeof raw.id !== 'string' || !MEDIA_ID_PATTERN.test(raw.id)) {
    return { error: `media[${index}].id 必须是有效媒体 ID` }
  }
  if (typeof raw.path !== 'string' || !MEDIA_PATH_PATTERN.test(raw.path)) {
    return { error: `media[${index}].path 必须是 media/<id>.<ext> 格式` }
  }
  if (!raw.path.startsWith(`media/${raw.id}.`)) {
    return { error: `media[${index}].path 与媒体 ID 不匹配` }
  }
  if (typeof raw.mimeType !== 'string' || !raw.mimeType.startsWith('image/')) {
    return { error: `media[${index}].mimeType 必须是图片 MIME 类型` }
  }
  if (!Number.isInteger(raw.width) || (raw.width as number) <= 0) {
    return { error: `media[${index}].width 必须是正整数` }
  }
  if (!Number.isInteger(raw.height) || (raw.height as number) <= 0) {
    return { error: `media[${index}].height 必须是正整数` }
  }
  if (!Number.isInteger(raw.byteSize) || (raw.byteSize as number) <= 0) {
    return { error: `media[${index}].byteSize 必须是正整数` }
  }
  if (typeof raw.sha256 !== 'string' || !SHA256_PATTERN.test(raw.sha256)) {
    return { error: `media[${index}].sha256 必须是 64 位十六进制 SHA-256` }
  }
  if (raw.fileName !== undefined && typeof raw.fileName !== 'string') {
    return { error: `media[${index}].fileName 必须是字符串` }
  }
  if (
    raw.createdAt !== undefined &&
    (typeof raw.createdAt !== 'string' || Number.isNaN(Date.parse(raw.createdAt)))
  ) {
    return { error: `media[${index}].createdAt 必须是有效 ISO 日期字符串` }
  }

  return {
    media: {
      id: raw.id,
      path: raw.path,
      mimeType: raw.mimeType,
      width: raw.width as number,
      height: raw.height as number,
      byteSize: raw.byteSize as number,
      sha256: raw.sha256.toLowerCase(),
      ...(typeof raw.fileName === 'string' ? { fileName: raw.fileName } : {}),
      ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}),
    },
  }
}

/** Fully validate backup JSON and all cross-file metadata relationships. */
export function validateBackupData(raw: unknown): { data: BackupData } | { error: string } {
  if (!isRecord(raw)) return { error: '备份数据必须是 JSON 对象' }

  const manifestResult = validateManifest(raw.manifest)
  if ('error' in manifestResult) return manifestResult
  const manifest = manifestResult.manifest

  if (manifest.schemaVersion > SCHEMA_VERSION) {
    return {
      error: `备份 schema 版本 (${manifest.schemaVersion}) 高于当前应用版本 (${SCHEMA_VERSION})，无法导入`,
    }
  }

  if (!Array.isArray(raw.entries)) return { error: 'entries 必须是数组' }
  const entries: Entry[] = []
  const entryIds = new Set<string>()
  for (let i = 0; i < raw.entries.length; i++) {
    const result = validateEntry(raw.entries[i])
    if ('error' in result) return { error: `entries[${i}]: ${result.error}` }
    if (result.entry.isDraft) {
      return { error: `entries[${i}] 是草稿记录，备份只允许包含已保存日记` }
    }
    if (entryIds.has(result.entry.id)) {
      return { error: `entries 包含重复 ID: ${result.entry.id}` }
    }
    entryIds.add(result.entry.id)
    entries.push(result.entry)
  }

  const tagsResult = validateTags(raw.tags)
  if ('error' in tagsResult) return tagsResult
  const tags = tagsResult.tags

  if (manifest.entryCount !== entries.length) {
    return {
      error: `manifest.entryCount (${manifest.entryCount}) 与 entries 数组长度 (${entries.length}) 不一致`,
    }
  }
  if (manifest.tagCount > tags.length + 100) {
    return {
      error: `manifest.tagCount (${manifest.tagCount}) 与 tags 数组长度 (${tags.length}) 严重不一致`,
    }
  }

  const media: BackupMediaMetadata[] = []
  if (manifest.schemaVersion >= 3) {
    if (!Array.isArray(raw.media)) return { error: 'schema v3 备份的 media 必须是数组' }
    const ids = new Set<string>()
    const paths = new Set<string>()
    for (let i = 0; i < raw.media.length; i++) {
      const result = validateMediaMetadata(raw.media[i], i)
      if ('error' in result) return result
      if (ids.has(result.media.id)) return { error: `media 包含重复 ID: ${result.media.id}` }
      if (paths.has(result.media.path)) return { error: `media 包含重复路径: ${result.media.path}` }
      ids.add(result.media.id)
      paths.add(result.media.path)
      media.push(result.media)
    }
    if (manifest.mediaCount !== media.length) {
      return {
        error: `manifest.mediaCount (${manifest.mediaCount ?? 0}) 与 media 数组长度 (${media.length}) 不一致`,
      }
    }
  }

  const referencedIds = new Set(entries.flatMap((entry) => collectMediaIds(entry.richContent)))
  if (manifest.schemaVersion < 3 && referencedIds.size > 0) {
    return { error: '旧版备份包含无法恢复的本地图片引用' }
  }
  const metadataIds = new Set(media.map((item) => item.id))
  for (const mediaId of referencedIds) {
    if (!metadataIds.has(mediaId)) {
      return { error: `富文本引用的图片缺少备份 metadata: ${mediaId}` }
    }
  }

  return { data: { manifest, entries, tags, media } }
}

/** Recompute checksum, preserving the exact legacy v1/v2 algorithm. */
export function verifyChecksum(data: BackupData): { valid: boolean; expected: string; actual: string } {
  const actual = data.manifest.schemaVersion >= 3
    ? computeChecksum(data.entries, data.tags, data.media ?? [])
    : computeChecksum(data.entries, data.tags)
  const expected = data.manifest.checksum
  return { valid: actual === expected, expected, actual }
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (!isRecord(value)) return value

  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) sorted[key] = stableJsonValue(value[key])
  }
  return sorted
}

/**
 * Deterministic checksum for backup JSON. Omitting `media` deliberately invokes
 * the original schema v1/v2 byte-for-byte algorithm.
 */
export function computeChecksum(
  entries: Entry[],
  tags: string[],
  media?: BackupMediaMetadata[],
): string {
  const payload = media === undefined
    ? { entries, tags }
    : stableJsonValue({ entries, tags, media })
  const content = JSON.stringify(payload)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
