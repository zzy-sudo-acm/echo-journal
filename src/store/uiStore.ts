import { create } from 'zustand'
import { settingsRepo } from '../db/repository'

export type Theme = 'dark' | 'light'
export type JournalFont = 'modern' | 'serif' | 'kai' | 'fangsong'

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
    const [theme, journalFont] = await Promise.all([
      settingsRepo.get<Theme>('theme', 'dark'),
      settingsRepo.get<JournalFont>('journalFont', 'modern'),
    ])
    set({ theme, journalFont })
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-journal-font', journalFont)
  },
}))
