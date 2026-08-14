import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { entryRepo } from './repository'
import type { Entry, TagInfo } from './models'

/** Shared stable empty array — keeps `?? EMPTY` from breaking memo deps. */
const EMPTY: never[] = []

/**
 * Subscribe to a Dexie liveQuery: the querier re-runs automatically whenever
 * the tables it reads change. Returns undefined until the first emission and
 * keeps the previous value across param changes to avoid flicker.
 */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)

  useEffect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (result) => setValue(result),
      error: (error) => console.error('[echo-journal] liveQuery error', error),
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller keys by deps
  }, deps)

  return value
}

/** Timeline entries for the most recent `days` local days, ascending. */
export function useTimelineEntries(days: number): Entry[] | undefined {
  return useLiveQuery(() => entryRepo.listRecentDays(days), [days])
}

/** Whether anything exists older than the loaded window — drives "加载更早". */
export function useHasEarlierEntries(days: number): boolean {
  return useLiveQuery(() => entryRepo.hasEntriesBeyondDays(days), [days]) ?? false
}

/** Active entries on one local date; empty array when no date is selected. */
export function useEntriesForDate(localDate: string | null): Entry[] | undefined {
  return useLiveQuery(
    () => (localDate ? entryRepo.listByDate(localDate) : Promise.resolve([])),
    [localDate],
  )
}

/** Local dates holding entries within one month (0-indexed), for calendar marks. */
export function useMonthEntryDates(year: number, month: number): string[] {
  return useLiveQuery(() => entryRepo.getDatesInMonth(year, month), [year, month]) ?? EMPTY
}

/** Entries written on this month/day in earlier years. */
export function useOnThisDayEntries(month: number, day: number): Entry[] | undefined {
  return useLiveQuery(() => entryRepo.getOnThisDay(month, day), [month, day])
}

export function useTrashEntries(): Entry[] {
  return useLiveQuery(() => entryRepo.listTrash(), []) ?? EMPTY
}

export function useAllTags(): TagInfo[] {
  return useLiveQuery(() => entryRepo.getAllTags(), []) ?? EMPTY
}
