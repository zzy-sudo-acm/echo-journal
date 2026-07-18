export const JOURNAL_FONT_LOAD_SAMPLE = '风吹过旧书页，也吹乱了今天的心事。转这后发里边体'

const journalFontFamilies = {
  rounded: 'Echo Journal Rounded',
  fangsong: 'Echo Journal Fangsong',
  display: 'Echo Journal Display',
  handwriting: 'Echo Journal Handwriting',
} as const

const previewFontFamilies = {
  rounded: 'Echo Preview Rounded',
  fangsong: 'Echo Preview Fangsong',
  display: 'Echo Preview Display',
  handwriting: 'Echo Preview Handwriting',
} as const

const fontLoads = new Map<string, Promise<boolean>>()

type HostedJournalFont = keyof typeof journalFontFamilies

function isHostedJournalFont(font: string): font is HostedJournalFont {
  return font in journalFontFamilies
}

function loadFontFamily(family: string) {
  const cached = fontLoads.get(family)
  if (cached) return cached

  const load = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return false
    const descriptor = `400 1rem "${family}"`
    try {
      const faces = await document.fonts.load(descriptor, JOURNAL_FONT_LOAD_SAMPLE)
      return faces.length > 0 && document.fonts.check(descriptor, JOURNAL_FONT_LOAD_SAMPLE)
    } catch {
      return false
    }
  })()

  fontLoads.set(family, load)
  void load.then((loaded) => {
    if (!loaded && fontLoads.get(family) === load) fontLoads.delete(family)
  })
  return load
}

export function loadJournalFont(font: string) {
  if (font === 'modern') return Promise.resolve(true)
  if (!isHostedJournalFont(font)) return Promise.resolve(false)
  return loadFontFamily(journalFontFamilies[font])
}

export function loadJournalFontPreview(font: string) {
  if (font === 'modern') return Promise.resolve(true)
  if (!isHostedJournalFont(font)) return Promise.resolve(false)
  return loadFontFamily(previewFontFamilies[font])
}
