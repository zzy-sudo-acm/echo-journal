import { create } from 'zustand'
import { entryRepo, draftRepo } from '../db/repository'
import type { Entry, CreateEntryInput, UpdateEntryInput } from '../db/models'
import { getLocalDateString } from '../utils/date'

/**
 * Global entry actions + draft + "today" rollover.
 *
 * Entry *reads* do not live here: pages subscribe to data through the
 * liveQuery hooks in `src/db/live.ts`, which refresh automatically on any
 * mutation. This store only carries cross-cutting actions and UI state.
 */
interface EntryState {
  draft: { content: string; title: string; tags: string[] } | null
  todayDate: string

  createEntry: (input: CreateEntryInput, options?: { clearDraft?: boolean }) => Promise<Entry>
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
  draft: null,
  todayDate: getLocalDateString(),

  createEntry: async (input, options) => {
    const entry = await entryRepo.create({ ...input, isDraft: false })
    if (options?.clearDraft !== false) {
      await draftRepo.clear()
      set({ draft: null })
    }
    return entry
  },

  updateEntry: async (id, patch) => {
    await entryRepo.update(id, patch)
  },

  deleteEntry: (id) => entryRepo.delete(id),

  restoreEntry: async (id) => {
    await entryRepo.restore(id)
  },

  permanentDeleteEntry: (id) => entryRepo.permanentDelete(id),

  emptyTrash: () => entryRepo.emptyTrash(),

  loadDraft: async () => {
    const draft = await draftRepo.get()
    set({ draft })
  },

  clearDraft: async () => {
    await draftRepo.clear()
    set({ draft: null })
  },

  /** Returns true when the local date rolled over (crossed midnight) and
   *  advances todayDate so date-driven UI re-renders. */
  checkDateChange: () => {
    const current = getLocalDateString()
    if (current === get().todayDate) return false
    set({ todayDate: current })
    return true
  },
}))
