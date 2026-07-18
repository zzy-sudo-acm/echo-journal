import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import {
  generateBackupData,
  generateMarkdown,
  createExportZip,
  previewBackup,
  parseImportFile,
  mergeImport,
  replaceImport,
  createRollbackSnapshot,
  rollbackToSnapshot,
} from '../services/backup'

describe('Backup Generation', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
    await db.snapshots.clear()
  })

  it('should generate backup data with entries and tags', async () => {
    await entryRepo.create({ content: '日记1', tags: ['标签1'] })
    await entryRepo.create({ content: '日记2', tags: ['标签2'] })

    const data = await generateBackupData()
    expect(data.manifest).toBeTruthy()
    expect(data.manifest.entryCount).toBe(2)
    expect(data.manifest.tagCount).toBe(2)
    expect(data.entries.length).toBe(2)
    expect(data.tags.length).toBe(2)
    expect(data.manifest.appName).toBe('回声日记')
    expect(data.manifest.schemaVersion).toBe(1)
    expect(data.manifest.checksum).toBeTruthy()
  })

  it('should generate correct manifest metadata', async () => {
    await entryRepo.create({
      content: '最旧的',
      createdAt: '2024-01-01T10:00:00.000Z',
    })
    await entryRepo.create({
      content: '最新的',
      createdAt: '2024-12-31T10:00:00.000Z',
    })

    const data = await generateBackupData()
    expect(data.manifest.earliestEntry).toBe('2024-01-01T10:00:00.000Z')
    expect(data.manifest.latestEntry).toBe('2024-12-31T10:00:00.000Z')
  })

  it('should exclude drafts from backup', async () => {
    await entryRepo.create({ content: '正式', isDraft: false })
    await entryRepo.create({ content: '草稿', isDraft: true })

    const data = await generateBackupData()
    expect(data.manifest.entryCount).toBe(1)
    expect(data.entries[0].content).toBe('正式')
  })

  it('should generate readable markdown', async () => {
    await entryRepo.create({
      title: '我的日记',
      content: '今天天气很好，出去散步了。',
      tags: ['生活'],
    })

    const data = await generateBackupData()
    const md = generateMarkdown(data.entries)

    expect(md).toContain('# 回声日记')
    expect(md).toContain('我的日记')
    expect(md).toContain('今天天气很好')
    expect(md).toContain('生活')
  })

  it('should create an export blob', async () => {
    await entryRepo.create({ content: '测试' })
    const blob = await createExportZip()
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(0)
  })
})

describe('Backup Import', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
    await db.snapshots.clear()
  })

  it('should parse a valid backup file', async () => {
    await entryRepo.create({ content: 'test', tags: ['tag'] })
    const data = await generateBackupData()

    const blob = await createExportZip()
    const file = new File([blob], 'backup.json', { type: 'application/json' })
    const parsed = await parseImportFile(file)

    expect(parsed).not.toBeNull()
    expect(parsed!.entries.length).toBe(1)
  })

  it('should return null for invalid file', async () => {
    const file = new File(['not valid json'], 'test.json', { type: 'application/json' })
    const parsed = await parseImportFile(file)
    expect(parsed).toBeNull()
  })

  it('should preview backup data correctly', async () => {
    await entryRepo.create({
      content: 'test',
      createdAt: '2024-06-15T10:00:00.000Z',
    })
    const data = await generateBackupData()
    const preview = previewBackup(data)

    expect(preview.isValid).toBe(true)
    expect(preview.entryCount).toBe(1)
    expect(preview.compatible).toBe(true)
    expect(preview.appVersion).toBe('1.0.0')
  })

  it('should detect incompatible schema versions', async () => {
    const data = await generateBackupData()
    data.manifest.schemaVersion = 999

    const preview = previewBackup(data)
    expect(preview.compatible).toBe(false)
    expect(preview.errors.length).toBeGreaterThan(0)
  })

  it('should merge import — add new entries', async () => {
    // Existing entry
    await entryRepo.create({ content: '已有日记' })

    // Create backup with different entries
    const backupEntries = [
      {
        id: 'imported-1',
        title: '',
        content: '导入日记',
        tags: ['导入'],
        createdAt: '2024-03-01T10:00:00.000Z',
        updatedAt: '2024-03-01T10:00:00.000Z',
        isDraft: false,
      },
    ]

    const result = await mergeImport({
      manifest: {
        appName: '回声日记',
        appVersion: '1.0.0',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entryCount: 1,
        tagCount: 1,
        earliestEntry: '2024-03-01T10:00:00.000Z',
        latestEntry: '2024-03-01T10:00:00.000Z',
        checksum: 'test',
      },
      entries: backupEntries,
      tags: ['导入'],
    })

    expect(result.added).toBe(1)
    expect(result.totalEntries).toBe(2)
  })

  it('should merge import — skip identical entries', async () => {
    const entry = await entryRepo.create({ content: '相同日记' })

    const result = await mergeImport({
      manifest: {
        appName: '回声日记',
        appVersion: '1.0.0',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entryCount: 1,
        tagCount: 0,
        earliestEntry: entry.createdAt,
        latestEntry: entry.createdAt,
        checksum: 'test',
      },
      entries: [entry],
      tags: [],
    })

    expect(result.skipped).toBe(1)
    expect(result.added).toBe(0)
  })

  it('should merge import — update newer entries', async () => {
    const entry = await entryRepo.create({ content: '旧版本' })

    const newerEntry = {
      ...entry,
      content: '新版本',
      updatedAt: new Date(Date.now() + 86400000).toISOString(), // +1 day
    }

    const result = await mergeImport({
      manifest: {
        appName: '回声日记',
        appVersion: '1.0.0',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entryCount: 1,
        tagCount: 0,
        earliestEntry: newerEntry.createdAt,
        latestEntry: newerEntry.createdAt,
        checksum: 'test',
      },
      entries: [newerEntry],
      tags: [],
    })

    expect(result.updated).toBe(1)

    const updated = await entryRepo.get(entry.id)
    expect(updated!.content).toBe('新版本')
  })

  it('should replace import — clear and import', async () => {
    await entryRepo.create({ content: '将被替换' })
    await entryRepo.create({ content: '也会被替换' })

    const backupEntries = [
      {
        id: 'replacement-1',
        title: '',
        content: '替换日记',
        tags: [],
        createdAt: '2024-05-01T10:00:00.000Z',
        updatedAt: '2024-05-01T10:00:00.000Z',
        isDraft: false,
      },
    ]

    await replaceImport({
      manifest: {
        appName: '回声日记',
        appVersion: '1.0.0',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        entryCount: 1,
        tagCount: 0,
        earliestEntry: '2024-05-01T10:00:00.000Z',
        latestEntry: '2024-05-01T10:00:00.000Z',
        checksum: 'test',
      },
      entries: backupEntries,
      tags: [],
    })

    const allEntries = await entryRepo.list()
    expect(allEntries.length).toBe(1)
    expect(allEntries[0].content).toBe('替换日记')
  })
})

describe('Rollback Mechanism', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
    await db.snapshots.clear()
  })

  it('should create a rollback snapshot', async () => {
    await entryRepo.create({ content: '重要日记', tags: ['重要'] })

    const snapshotId = await createRollbackSnapshot()
    expect(snapshotId).toBeTruthy()

    const snapshot = await db.snapshots.get(snapshotId)
    expect(snapshot).not.toBeUndefined()
    expect(snapshot!.entryCount).toBe(1)
    expect(snapshot!.isPinned).toBe(true)
  })

  it('should rollback to a snapshot after data loss', async () => {
    await entryRepo.create({ content: '原始日记' })

    const snapshotId = await createRollbackSnapshot()

    // Simulate data loss
    await db.entries.clear()
    expect(await entryRepo.getEntryCount()).toBe(0)

    // Rollback
    await rollbackToSnapshot(snapshotId)
    expect(await entryRepo.getEntryCount()).toBe(1)
  })

  it('should throw on non-existent snapshot', async () => {
    await expect(rollbackToSnapshot('nonexistent')).rejects.toThrow('回滚快照不存在')
  })
})

describe('Export Filename', () => {
  it('should generate correct filename format', async () => {
    // Import dynamically to test filename
    const { generateExportFilename } = await import('../services/backup')
    const filename = generateExportFilename()
    expect(filename).toMatch(/^echo-journal-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/)
  })
})
