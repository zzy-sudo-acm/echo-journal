import { create } from 'zustand'
import { entryRepo, draftRepo } from '../db/repository'
import type { Entry, CreateEntryInput, UpdateEntryInput, EntryQuery } from '../db/models'

interface EntryState {
  entries: Entry[]
  todayEntries: Entry[]
  onThisDayEntries: Entry[]
  draft: { content: string; title: string; tags: string[] } | null
  loading: boolean
  autoSaveTimer: ReturnType<typeof setTimeout> | null

  loadToday: () => Promise<void>
  loadEntries: (query?: EntryQuery) => Promise<void>
  loadOnThisDay: (month: number, day: number) => Promise<void>
  createEntry: (input: CreateEntryInput) => Promise<Entry>
  updateEntry: (id: string, patch: UpdateEntryInput) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  saveDraft: (draft: { content: string; title: string; tags: string[] }) => void
  loadDraft: () => Promise<void>
  clearDraft: () => Promise<void>
}

export const useEntryStore = create<EntryState>((set, get) => ({
  entries: [],
  todayEntries: [],
  onThisDayEntries: [],
  draft: null,
  loading: false,
  autoSaveTimer: null,

  loadToday: async () => {
    const today = new Date().toISOString().slice(0, 10)
    const entries = await entryRepo.list({
      date: today,
      isDraft: false,
      orderBy: 'createdAt',
      orderDir: 'desc',
    })
    set({ todayEntries: entries })
  },

  loadEntries: async (query?: EntryQuery) => {
    set({ loading: true })
    const entries = await entryRepo.list({
      isDraft: false,
      ...query,
    })
    set({ entries, loading: false })
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

  saveDraft: (draft) => {
    set({ draft })
    const timer = get().autoSaveTimer
    if (timer) clearTimeout(timer)
    const newTimer = setTimeout(() => {
      draftRepo.save(draft)
    }, 500)
    set({ autoSaveTimer: newTimer })
  },

  loadDraft: async () => {
    const draft = await draftRepo.get()
    set({ draft })
  },

  clearDraft: async () => {
    await draftRepo.clear()
    set({ draft: null })
  },
}))
