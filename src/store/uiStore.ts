import { create } from 'zustand'
import { settingsRepo } from '../db/repository'
import { loadJournalFont } from '../utils/journalFonts'

export type Theme = 'dark' | 'light'
export type JournalFont = 'modern' | 'rounded' | 'fangsong' | 'display' | 'handwriting'

const journalFonts = new Set<JournalFont>(['modern', 'rounded', 'fangsong', 'display', 'handwriting'])
let journalFontRequest = 0

function normalizeJournalFont(value: unknown): JournalFont {
  if (value === 'wenkai') return 'rounded'
  if (value === 'kai' || value === 'serif') return 'fangsong'
  return typeof value === 'string' && journalFonts.has(value as JournalFont)
    ? value as JournalFont
    : 'modern'
}

interface UIState {
  theme: Theme
  journalFont: JournalFont
  loadingJournalFont: JournalFont | null
  setTheme: (theme: Theme) => Promise<void>
  setJournalFont: (font: JournalFont) => Promise<void>
  initAppearance: () => Promise<void>
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'dark',
  journalFont: 'modern',
  loadingJournalFont: null,

  setTheme: async (theme: Theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
    await settingsRepo.set('theme', theme)
  },

  setJournalFont: async (journalFont: JournalFont) => {
    if (get().journalFont === journalFont && get().loadingJournalFont === null) return
    const request = ++journalFontRequest

    if (journalFont === 'modern') {
      set({ journalFont, loadingJournalFont: null })
      document.documentElement.setAttribute('data-journal-font', journalFont)
      await settingsRepo.set('journalFont', journalFont)
      return
    }

    set({ loadingJournalFont: journalFont })
    const loaded = await loadJournalFont(journalFont)
    if (request !== journalFontRequest) return

    const appliedFont = loaded ? journalFont : 'modern'
    set({ journalFont: appliedFont, loadingJournalFont: null })
    document.documentElement.setAttribute('data-journal-font', appliedFont)
    await settingsRepo.set('journalFont', appliedFont)
  },

  initAppearance: async () => {
    const [theme, savedJournalFont] = await Promise.all([
      settingsRepo.get<Theme>('theme', 'dark'),
      settingsRepo.get<unknown>('journalFont', 'modern'),
    ])
    const requestedFont = normalizeJournalFont(savedJournalFont)
    document.documentElement.setAttribute('data-theme', theme)
    const loaded = await loadJournalFont(requestedFont)
    const journalFont = loaded ? requestedFont : 'modern'

    set({ theme, journalFont, loadingJournalFont: null })
    document.documentElement.setAttribute('data-journal-font', journalFont)

    if (journalFont !== savedJournalFont) {
      await settingsRepo.set('journalFont', journalFont)
    }
  },
}))
