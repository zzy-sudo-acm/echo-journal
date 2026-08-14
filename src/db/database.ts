import Dexie, { type Table } from 'dexie'
import type { Entry, Draft, InternalSnapshot, JournalMedia } from './models'
import { SCHEMA_VERSION } from './models'

export class EchoJournalDB extends Dexie {
  entries!: Table<Entry, string>
  drafts!: Table<Draft, string>
  snapshots!: Table<InternalSnapshot, string>
  media!: Table<JournalMedia, string>
  tags!: Table<{ name: string }, string>
  settings!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('EchoJournal')
    // Version 1: initial schema
    this.version(1).stores({
      entries: 'id, createdAt, updatedAt, isDraft, *tags',
      drafts: 'id, savedAt',
      snapshots: 'id, createdAt, isPinned',
      tags: 'name',
      settings: 'key',
    })
    // Version 2: soft delete — add deletedAt index.
    // No migration needed: existing entries without deletedAt are active by default.
    this.version(2).stores({
      entries: 'id, createdAt, updatedAt, isDraft, deletedAt, *tags',
      drafts: 'id, savedAt',
      snapshots: 'id, createdAt, isPinned',
      tags: 'name',
      settings: 'key',
    })
    // Version 3: locally persisted rich-entry image binaries.
    // Blob is deliberately not indexed.
    this.version(SCHEMA_VERSION).stores({
      entries: 'id, createdAt, updatedAt, isDraft, deletedAt, *tags',
      drafts: 'id, savedAt',
      snapshots: 'id, createdAt, isPinned',
      media: 'id, createdAt',
      tags: 'name',
      settings: 'key',
    })
  }
}

export const db = new EchoJournalDB()
