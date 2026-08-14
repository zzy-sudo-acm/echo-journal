import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
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
    })
  })

  it('returns false when date has not changed', () => {
    const current = getLocalDateString()
    useEntryStore.setState({ todayDate: current })
    expect(useEntryStore.getState().checkDateChange()).toBe(false)
    expect(useEntryStore.getState().todayDate).toBe(current)
  })

  it('advances todayDate and returns true after the date rolled over', () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })

    const result = useEntryStore.getState().checkDateChange()

    expect(result).toBe(true)
    expect(useEntryStore.getState().todayDate).toBe(getLocalDateString())
  })

  it('subsequent checks return false once todayDate caught up', () => {
    useEntryStore.setState({ todayDate: '2000-01-01' })

    expect(useEntryStore.getState().checkDateChange()).toBe(true)
    expect(useEntryStore.getState().checkDateChange()).toBe(false)
  })
})
