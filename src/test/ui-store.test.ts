import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { settingsRepo } from '../db/repository'

const { loadJournalFontMock } = vi.hoisted(() => ({
  loadJournalFontMock: vi.fn(),
}))

vi.mock('../utils/journalFonts', () => ({
  loadJournalFont: loadJournalFontMock,
}))

import { useUIStore } from '../store/uiStore'

describe('UI font loading', () => {
  const pendingLoads = new Map<string, (loaded: boolean) => void>()

  beforeEach(async () => {
    await db.settings.clear()
    pendingLoads.clear()
    loadJournalFontMock.mockReset()
    loadJournalFontMock.mockImplementation((font: string) => {
      if (font === 'modern') return Promise.resolve(true)
      return new Promise<boolean>((resolve) => pendingLoads.set(font, resolve))
    })
    useUIStore.setState({ theme: 'dark', journalFont: 'modern', loadingJournalFont: null })
    document.documentElement.setAttribute('data-journal-font', 'modern')
  })

  it('applies only the last requested font after it finishes loading', async () => {
    const rounded = useUIStore.getState().setJournalFont('rounded')
    const handwriting = useUIStore.getState().setJournalFont('handwriting')

    expect(useUIStore.getState().loadingJournalFont).toBe('handwriting')
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('modern')

    pendingLoads.get('rounded')?.(true)
    await rounded
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('modern')

    pendingLoads.get('handwriting')?.(true)
    await handwriting
    expect(useUIStore.getState().journalFont).toBe('handwriting')
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('handwriting')
    expect(await settingsRepo.get('journalFont', 'modern')).toBe('handwriting')
  })

  it('falls back to modern when a hosted font cannot load', async () => {
    const handwriting = useUIStore.getState().setJournalFont('handwriting')
    pendingLoads.get('handwriting')?.(false)
    await handwriting

    expect(useUIStore.getState().journalFont).toBe('modern')
    expect(useUIStore.getState().loadingJournalFont).toBeNull()
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('modern')
    expect(await settingsRepo.get('journalFont', 'handwriting')).toBe('modern')
  })

  it('loads a saved hosted font before applying it during initialization', async () => {
    await settingsRepo.set('theme', 'light')
    await settingsRepo.set('journalFont', 'handwriting')

    const initialization = useUIStore.getState().initAppearance()
    await vi.waitFor(() => expect(pendingLoads.has('handwriting')).toBe(true))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('modern')

    pendingLoads.get('handwriting')?.(true)
    await initialization
    expect(document.documentElement.getAttribute('data-journal-font')).toBe('handwriting')
  })
})
