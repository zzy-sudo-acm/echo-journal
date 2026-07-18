import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import {
  createDailySnapshot,
  cleanupOldSnapshots,
  getSnapshots,
  pinSnapshot,
  deleteSnapshot,
  restoreFromSnapshot,
} from '../services/snapshot'
import { getLocalDateString } from '../utils/date'

describe('Daily Snapshots', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.tags.clear()
    await db.snapshots.clear()
  })

  it('should create a daily snapshot using local date', async () => {
    await entryRepo.create({ content: '日记1' })

    const snap = await createDailySnapshot()
    expect(snap).not.toBeNull()
    expect(snap!.entryCount).toBe(1)

    // Verify snapshot ID uses LOCAL date, not UTC
    const localDate = getLocalDateString()
    expect(snap!.id).toContain(localDate)

    const stored = await db.snapshots.get(snap!.id)
    expect(stored).not.toBeUndefined()
    const parsed = JSON.parse(stored!.data)
    expect(parsed.entries.length).toBe(1)
  })

  it('should not create duplicate snapshot on same day', async () => {
    await entryRepo.create({ content: '日记1' })
    const first = await createDailySnapshot()
    expect(first).not.toBeNull()

    const second = await createDailySnapshot()
    expect(second).toBeNull()
  })

  it('should validate snapshot data on creation', async () => {
    await entryRepo.create({ content: '日记' })
    const snap = await createDailySnapshot()
    expect(snap).not.toBeNull()

    const stored = await db.snapshots.get(snap!.id)
    const parsed = JSON.parse(stored!.data)
    expect(parsed.manifest).toBeTruthy()
    expect(parsed.manifest.entryCount).toBe(parsed.entries.length)
  })

  it('should cleanup old snapshots keeping last 7', async () => {
    await entryRepo.create({ content: '日记' })
    for (let i = 0; i < 10; i++) {
      await db.snapshots.put({
        id: `snap-old-${i}`, createdAt: new Date(2024, 0, i + 1).toISOString(),
        entryCount: 1, tagCount: 0, size: 100, isPinned: false,
        data: JSON.stringify({ manifest: { entryCount: 1, schemaVersion: 1 }, entries: [], tags: [] }),
      })
    }
    await cleanupOldSnapshots()
    const remaining = await getSnapshots()
    expect(remaining.length).toBeLessThanOrEqual(7)
  })

  it('should never delete pinned snapshots', async () => {
    await entryRepo.create({ content: '日记' })
    for (let i = 0; i < 5; i++) {
      await db.snapshots.put({
        id: `snap-${i}`, createdAt: new Date(2024, 0, i + 1).toISOString(),
        entryCount: 1, tagCount: 0, size: 100, isPinned: false, data: '{}',
      })
    }
    await db.snapshots.put({
      id: 'snap-pinned', createdAt: new Date(2023, 0, 1).toISOString(),
      entryCount: 1, tagCount: 0, size: 100, isPinned: true, data: '{}',
    })
    await cleanupOldSnapshots()
    const pinned = await db.snapshots.get('snap-pinned')
    expect(pinned).not.toBeUndefined()
  })

  it('should toggle pin status', async () => {
    await db.snapshots.put({
      id: 'snap-1', createdAt: new Date().toISOString(),
      entryCount: 0, tagCount: 0, size: 10, isPinned: false, data: '{}',
    })
    await pinSnapshot('snap-1')
    let snap = await db.snapshots.get('snap-1')
    expect(snap!.isPinned).toBe(true)

    await pinSnapshot('snap-1')
    snap = await db.snapshots.get('snap-1')
    expect(snap!.isPinned).toBe(false)
  })

  it('should delete a snapshot', async () => {
    await db.snapshots.put({
      id: 'snap-del', createdAt: new Date().toISOString(),
      entryCount: 0, tagCount: 0, size: 10, isPinned: false, data: '{}',
    })
    await deleteSnapshot('snap-del')
    const snap = await db.snapshots.get('snap-del')
    expect(snap).toBeUndefined()
  })

  it('should restore from snapshot', async () => {
    await entryRepo.create({ content: '原始日记', tags: ['原始'] })
    const snap = await createDailySnapshot()
    expect(snap).not.toBeNull()

    // Add more data
    await entryRepo.create({ content: '新增日记' })

    // Restore
    await restoreFromSnapshot(snap!.id)

    const entries = await entryRepo.list()
    expect(entries.length).toBe(1)
    expect(entries[0].content).toBe('原始日记')
  })

  it('should list snapshots in reverse chronological order', async () => {
    await db.snapshots.put({
      id: 'snap-older', createdAt: '2024-01-01T00:00:00.000Z',
      entryCount: 0, tagCount: 0, size: 10, isPinned: false, data: '{}',
    })
    await db.snapshots.put({
      id: 'snap-newer', createdAt: '2024-06-01T00:00:00.000Z',
      entryCount: 0, tagCount: 0, size: 10, isPinned: false, data: '{}',
    })
    const snaps = await getSnapshots()
    expect(snaps[0].id).toBe('snap-newer')
    expect(snaps[1].id).toBe('snap-older')
  })

  // ── Fault injection: snapshot restore fails → original data recovered ──
  it('should recover original data when snapshot restore fails', async () => {
    await entryRepo.create({ content: '原始数据', tags: ['重要'] })

    // Create a snapshot that will fail post-validation
    await db.snapshots.put({
      id: 'bad-snap',
      createdAt: new Date().toISOString(),
      entryCount: 5, // Wrong count — will trigger post-validation failure
      tagCount: 0,
      size: 100,
      isPinned: false,
      data: JSON.stringify({
        manifest: {
          appName: '回声日记', appVersion: '1.0.0', schemaVersion: 1,
          exportedAt: new Date().toISOString(), entryCount: 5, tagCount: 0,
          earliestEntry: null, latestEntry: null, checksum: 'abc',
        },
        entries: [], // Empty entries but manifest says 5
        tags: [],
      }),
    })

    let threw = false
    try {
      await restoreFromSnapshot('bad-snap')
    } catch {
      threw = true
    }

    expect(threw).toBe(true)

    // Original data must be intact
    const entries = await entryRepo.list()
    expect(entries.length).toBe(1)
    expect(entries[0].content).toBe('原始数据')
  })
})
