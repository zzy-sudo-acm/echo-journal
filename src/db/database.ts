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
    this.version(SCHEMA_VERSION).stores({
      entries: 'id, createdAt, updatedAt, isDraft, *tags',
      drafts: 'id, savedAt',
      snapshots: 'id, createdAt, isPinned',
      tags: 'name',
      settings: 'key',
    })
  }
}

export const db = new EchoJournalDB()
