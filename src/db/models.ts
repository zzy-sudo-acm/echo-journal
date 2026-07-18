export interface Entry {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  isDraft: boolean
  deletedAt?: string // ISO 8601 — soft delete marker; absent for active entries
}

export interface CreateEntryInput {
  title?: string
  content: string
  tags?: string[]
  createdAt?: string
  isDraft?: boolean
}

export interface UpdateEntryInput {
  title?: string
  content?: string
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
  savedAt: string
}

export interface InternalSnapshot {
  id: string
  createdAt: string
  entryCount: number
  tagCount: number
  size: number
  isPinned: boolean
  data: string // JSON-serialized backup
}

export interface BackupManifest {
  appName: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  entryCount: number
  tagCount: number
  earliestEntry: string | null
  latestEntry: string | null
  checksum: string
}

export interface BackupData {
  manifest: BackupManifest
  entries: Entry[]
  tags: string[]
}

export interface ExportPreview {
  entryCount: number
  tagCount: number
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

export const SCHEMA_VERSION = 2
export const APP_VERSION = '1.0.0'
export const APP_NAME = '回声日记'
