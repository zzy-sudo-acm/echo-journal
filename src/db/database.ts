import Dexie, { type Table } from 'dexie'
import type { Entry, Draft, InternalSnapshot } from './models'
import { SCHEMA_VERSION } from './models'

export class EchoJournalDB extends Dexie {
  entries!: Table<Entry, string>
  drafts!: Table<Draft, string>
  snapshots!: Table<InternalSnapshot, string>
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
    // Version 2: soft delete — add deletedAt index
    this.version(SCHEMA_VERSION).stores({
      entries: 'id, createdAt, updatedAt, isDraft, deletedAt, *tags',
      drafts: 'id, savedAt',
      snapshots: 'id, createdAt, isPinned',
      tags: 'name',
      settings: 'key',
    }).upgrade(async (tx) => {
      // Existing entries without deletedAt remain as active entries.
      // No data migration needed — undefined deletedAt means active.
      await tx.table('entries').toCollection().modify((entry: Entry) => {
        if (entry.deletedAt === undefined) {
          // Keep as-is; Dexie will index undefined as not-present
        }
      })
    })
  }
}

export const db = new EchoJournalDB()
