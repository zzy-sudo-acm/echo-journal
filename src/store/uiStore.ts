import { create } from 'zustand'
import { settingsRepo } from '../db/repository'

type Theme = 'dark' | 'light'

interface UIState {
  theme: Theme
  setTheme: (theme: Theme) => Promise<void>
  initTheme: () => Promise<void>
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',

  setTheme: async (theme: Theme) => {
    set({ theme })
    await settingsRepo.set('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  },

  initTheme: async () => {
    const saved = await settingsRepo.get<Theme>('theme', 'dark')
    set({ theme: saved })
    document.documentElement.setAttribute('data-theme', saved)
  },
}))
