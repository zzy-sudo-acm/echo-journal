import { entryRepo } from '../db/repository'
import type { Entry } from '../db/models'

export interface SearchResult {
  entry: Entry
  matches: {
    field: 'title' | 'content' | 'tags'
    snippet: string
  }[]
  score: number
}

export async function searchEntries(
  keyword: string,
  tag?: string,
): Promise<SearchResult[]> {
  const entries = await entryRepo.list({
    keyword,
    tag,
    isDraft: false,
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  const kw = keyword.toLowerCase()
  const results: SearchResult[] = []

  for (const entry of entries) {
    const matches: SearchResult['matches'] = []
    let score = 0

    if (entry.content.toLowerCase().includes(kw)) {
      const idx = entry.content.toLowerCase().indexOf(kw)
      const start = Math.max(0, idx - 30)
      const end = Math.min(entry.content.length, idx + kw.length + 30)
      let snippet = entry.content.slice(start, end)
      if (start > 0) snippet = '…' + snippet
      if (end < entry.content.length) snippet += '…'
      matches.push({ field: 'content', snippet })
      score += 10
    }

    if (entry.title.toLowerCase().includes(kw)) {
      matches.push({ field: 'title', snippet: entry.title })
      score += 5
    }

    const matchedTag = entry.tags.find((t) => t.toLowerCase().includes(kw))
    if (matchedTag) {
      matches.push({ field: 'tags', snippet: matchedTag })
      score += 3
    }

    if (matches.length > 0) {
      results.push({ entry, matches, score })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
