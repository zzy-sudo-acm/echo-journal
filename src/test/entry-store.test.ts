import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { entryRepo } from '../db/repository'
import { useEntryStore } from '../store/entryStore'
import { getLocalDateString } from '../utils/date'

describe('EntryStore checkDateChange', () => {
  beforeEach(async () => {
    await db.entries.clear()
    await db.drafts.clear()
    await db.tags.clear()
    // Reset store state between tests
    useEntryStore.setState({
      todayDate: getLocalDateString(),
      todayEntries: [],
    })
  })

  it('updates todayDate when loadToday succeeds', async () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })
    expect(useEntryStore.getState().todayDate).toBe('2000-01-01')

    const result = useEntryStore.getState().checkDateChange()
    expect(result).toBe(true)

    // Wait for async loadToday
    await vi.waitFor(() => {
      expect(useEntryStore.getState().todayDate).toBe(getLocalDateString())
    })
  })

  it('does not update todayDate when loadToday fails', async () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })

    // Spy on loadToday to make it reject
    const originalLoadToday = useEntryStore.getState().loadToday
    useEntryStore.setState({
      loadToday: () => Promise.reject(new Error('simulated')),
    } as any)

    useEntryStore.getState().checkDateChange()

    // todayDate should remain unchanged after failed load
    await vi.waitFor(() => {
      // Just wait a tick
      expect(true).toBe(true)
    })

    expect(useEntryStore.getState().todayDate).toBe('2000-01-01')

    // Restore
    useEntryStore.setState({ loadToday: originalLoadToday } as any)
  })

  it('retries on second call after first failure', async () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })

    let calls = 0
    const originalLoadToday = useEntryStore.getState().loadToday
    useEntryStore.setState({
      loadToday: () => {
        calls++
        return calls === 1
          ? Promise.reject(new Error('first fail'))
          : entryRepo.list({ date: getLocalDateString(), isDraft: false, orderBy: 'createdAt', orderDir: 'desc' })
            .then((entries) => useEntryStore.setState({ todayEntries: entries, todayDate: getLocalDateString() }))
      },
    } as any)

    // First call fails
    useEntryStore.getState().checkDateChange()
    await vi.waitFor(() => expect(calls).toBe(1))
    expect(useEntryStore.getState().todayDate).toBe('2000-01-01')

    // Second call succeeds
    useEntryStore.getState().checkDateChange()
    await vi.waitFor(() => {
      expect(useEntryStore.getState().todayDate).toBe(getLocalDateString())
    })

    // Restore
    useEntryStore.setState({ loadToday: originalLoadToday } as any)
  })

  it('returns false when date has not changed', () => {
    const current = getLocalDateString()
    useEntryStore.setState({ todayDate: current })
    expect(useEntryStore.getState().checkDateChange()).toBe(false)
  })

  it('does not produce unhandled promise rejection', async () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })

    const originalLoadToday = useEntryStore.getState().loadToday
    useEntryStore.setState({
      loadToday: () => Promise.reject(new Error('fail silently')),
    } as any)

    // This should not throw an unhandled rejection
    useEntryStore.getState().checkDateChange()

    // Give it time to reject
    await new Promise((r) => setTimeout(r, 50))

    // Restore
    useEntryStore.setState({ loadToday: originalLoadToday } as any)
  })
})
