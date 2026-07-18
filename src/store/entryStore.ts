import { create } from 'zustand'
import { entryRepo, draftRepo } from '../db/repository'
import type { Entry, CreateEntryInput, UpdateEntryInput, EntryQuery } from '../db/models'
import { getLocalDateString } from '../utils/date'

interface EntryState {
  entries: Entry[]
  todayEntries: Entry[]
  onThisDayEntries: Entry[]
  draft: { content: string; title: string; tags: string[] } | null
  loading: boolean
  todayDate: string

  loadToday: () => Promise<void>
  loadEntries: (query?: EntryQuery) => Promise<void>
  loadOnThisDay: (month: number, day: number) => Promise<void>
  createEntry: (input: CreateEntryInput) => Promise<Entry>
  updateEntry: (id: string, patch: UpdateEntryInput) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (id: string) => Promise<void>
  permanentDeleteEntry: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  loadDraft: () => Promise<void>
  clearDraft: () => Promise<void>
  checkDateChange: () => boolean
}

export const useEntryStore = create<EntryState>((set, get) => ({
  entries: [],
  todayEntries: [],
  onThisDayEntries: [],
  draft: null,
  loading: false,
  todayDate: getLocalDateString(),

  loadToday: async () => {
    const today = getLocalDateString()
    const entries = await entryRepo.list({
      date: today,
      isDraft: false,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    set({ todayEntries: entries, todayDate: today })
  },

  loadEntries: async (query?: EntryQuery) => {
    set({ loading: true })
    try {
      const entries = await entryRepo.list({
        isDraft: false,
        ...query,
      })
      set({ entries, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  loadOnThisDay: async (month: number, day: number) => {
    const entries = await entryRepo.getOnThisDay(month, day)
    set({ onThisDayEntries: entries })
  },

  createEntry: async (input: CreateEntryInput) => {
    const entry = await entryRepo.create({ ...input, isDraft: false })
    await get().loadToday()
    await draftRepo.clear()
    set({ draft: null })
    return entry
  },

  updateEntry: async (id: string, patch: UpdateEntryInput) => {
    await entryRepo.update(id, patch)
    await get().loadToday()
  },

  deleteEntry: async (id: string) => {
    await entryRepo.delete(id)
    await get().loadToday()
  },

  restoreEntry: async (id: string) => {
    await entryRepo.restore(id)
    await get().loadToday()
  },

  permanentDeleteEntry: async (id: string) => {
    await entryRepo.permanentDelete(id)
  },

  emptyTrash: async () => {
    await entryRepo.emptyTrash()
  },

  loadDraft: async () => {
    const draft = await draftRepo.get()
    set({ draft })
  },

  clearDraft: async () => {
    await draftRepo.clear()
    set({ draft: null })
  },

  /** Returns true if the local date changed (crossed midnight) */
  checkDateChange: () => {
    const current = getLocalDateString()
    if (current !== get().todayDate) {
      set({ todayDate: current })
      // Reload today's entries — fire-and-forget
      void get().loadToday()
      return true
    }
    return false
  },
}))