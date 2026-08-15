import type { JSONContent } from '@tiptap/core'

/** Serializable Tiptap document stored with an entry. */
export type RichContent = JSONContent

export interface Entry {
  id: string
  title: string
  content: string
  richContent?: RichContent
  tags: string[]
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  isDraft: boolean
  deletedAt?: string // ISO 8601 — soft delete marker; absent for active entries
}

export interface CreateEntryInput {
  title?: string
  content: string
  richContent?: RichContent
  tags?: string[]
  createdAt?: string
  isDraft?: boolean
}

export interface UpdateEntryInput {
  title?: string
  content?: string
  /** Pass null to deliberately convert an entry back to plain text. */
  richContent?: RichContent | null
  tags?: string[]
  createdAt?: string
  isDraft?: boolean
}

export interface EntryQuery {
  date?: string // YYYY-MM-DD
  year?: number
  month?: number // 0-indexed
  tag?: string
  keyword?: string
  isDraft?: boolean
  limit?: number
  offset?: number
  orderBy?: 'createdAt' | 'updatedAt'
  orderDir?: 'asc' | 'desc'
}

export interface TagInfo {
  name: string
  count: number
}

export interface Draft {
  id: string
  content: string
  title: string
  tags: string[]
  /** Media attached to the quick composer, preserved across restarts. */
  mediaIds?: string[]
  savedAt: string
}

export interface JournalMedia {
  id: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  fileName?: string
  createdAt: string
}

export interface CreateJournalMediaInput {
  id?: string
  blob: Blob
  mimeType: string
  width: number
  height: number
  fileName?: string
  createdAt?: string
}

export interface UpdateJournalMediaInput {
  blob?: Blob
  mimeType?: string
  width?: number
  height?: number
  fileName?: string
}

export interface InternalSnapshot {
  id: string
  createdAt: string
  entryCount: number
  tagCount: number
  size: number
  isPinned: boolean
  /** Media retained by this snapshot. Optional for schema v1/v2 snapshots. */
  mediaIds?: string[]
  data: string // JSON-serialized backup
}

/** Metadata stored in backup JSON; the binary itself lives at `path` in the ZIP. */
export interface BackupMediaMetadata {
  id: string
  path: string
  mimeType: string
  width?: number
  height?: number
  byteSize: number
  sha256: string
  fileName?: string
  createdAt?: string
}

export interface BackupManifest {
  appName: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  entryCount: number
  tagCount: number
  /** Absent only in legacy schema v1/v2 backups. */
  mediaCount?: number
  earliestEntry: string | null
  latestEntry: string | null
  checksum: string
}

export interface BackupData {
  manifest: BackupManifest
  entries: Entry[]
  tags: string[]
  /** Absent only in legacy schema v1/v2 backups. */
  media?: BackupMediaMetadata[]
}

/** Fully parsed backup, including media binaries reconstructed from the archive. */
export interface ParsedBackup {
  data: BackupData
  media: JournalMedia[]
  checksumValid: boolean
}

export interface ExportPreview {
  entryCount: number
  tagCount: number
  mediaCount: number
  activeEntryCount: number
  trashEntryCount: number
  earliestEntry: string | null
  latestEntry: string | null
  appVersion: string
  schemaVersion: number
  exportedAt: string
  isValid: boolean
  errors: string[]
  compatible: boolean
}

export interface ImportResult {
  added: number
  skipped: number
  updated: number
  conflicts: number
  totalEntries: number
}

export const SCHEMA_VERSION = 3
export const APP_VERSION = '1.1.0'
export const APP_NAME = '回声日记'
