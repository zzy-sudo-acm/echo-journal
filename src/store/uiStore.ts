import { create } from 'zustand'
import { settingsRepo } from '../db/repository'

export type Theme = 'dark' | 'light'
export type JournalFont = 'modern' | 'wenkai' | 'serif' | 'fangsong' | 'handwriting'

const journalFonts = new Set<JournalFont>(['modern', 'wenkai', 'serif', 'fangsong', 'handwriting'])

function normalizeJournalFont(value: unknown): JournalFont {
  if (value === 'kai') return 'wenkai'
  return typeof value === 'string' && journalFonts.has(value as JournalFont)
    ? value as JournalFont
    : 'modern'
}

interface UIState {
  theme: Theme
  journalFont: JournalFont
  setTheme: (theme: Theme) => Promise<void>
  setJournalFont: (font: JournalFont) => Promise<void>
  initAppearance: () => Promise<void>
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  journalFont: 'modern',

  setTheme: async (theme: Theme) => {
    set({ theme })
    document.documentElement.setAttribute('data-theme', theme)
    await settingsRepo.set('theme', theme)
  },

  setJournalFont: async (journalFont: JournalFont) => {
    set({ journalFont })
    document.documentElement.setAttribute('data-journal-font', journalFont)
    await settingsRepo.set('journalFont', journalFont)
  },

  initAppearance: async () => {
    const [theme, savedJournalFont] = await Promise.all([
      settingsRepo.get<Theme>('theme', 'dark'),
      settingsRepo.get<unknown>('journalFont', 'modern'),
    ])
    const journalFont = normalizeJournalFont(savedJournalFont)

    set({ theme, journalFont })
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-journal-font', journalFont)

    if (journalFont !== savedJournalFont) {
      await settingsRepo.set('journalFont', journalFont)
    }
  },
}))
