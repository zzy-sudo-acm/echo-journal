import { entryRepo } from '../db/repository'
import type { Entry } from '../db/models'
import { toLocalDate } from '../utils/date'

export type SearchDateFilter =
  | { mode: 'all' }
  | { mode: 'day'; date: string }
  | { mode: 'month'; year: number; month: number }
  | { mode: 'range'; start: string; end: string }

export const NO_DATE_FILTER: SearchDateFilter = { mode: 'all' }

function formatLocalDate(date: string, includeYear = true): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN', {
    year: includeYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
  })
}

export function formatSearchDateFilter(filter: SearchDateFilter): string | null {
  if (filter.mode === 'all') return null
  if (filter.mode === 'day') return formatLocalDate(filter.date)
  if (filter.mode === 'month') return `${filter.year}年${filter.month + 1}月`

  const startYear = filter.start.slice(0, 4)
  const endYear = filter.end.slice(0, 4)
  return `${formatLocalDate(filter.start)} — ${formatLocalDate(filter.end, startYear !== endYear)}`
}

export interface SearchResult {
  entry: Entry
  matches: {
    field: 'title' | 'content' | 'tags'
    snippet: string
  }[]
  score: number
}

export function entryMatchesSearchDate(entry: Entry, filter: SearchDateFilter): boolean {
  if (filter.mode === 'all') return true
  const localDate = toLocalDate(entry.createdAt)
  if (filter.mode === 'day') return localDate === filter.date
  if (filter.mode === 'month') {
    const monthPrefix = `${filter.year}-${String(filter.month + 1).padStart(2, '0')}`
    return localDate.startsWith(monthPrefix)
  }
  return localDate >= filter.start && localDate <= filter.end
}

export async function searchEntries(
  keyword: string,
  tag?: string,
  dateFilter: SearchDateFilter = NO_DATE_FILTER,
): Promise<SearchResult[]> {
  const normalizedKeyword = keyword.trim()
  const entries = await entryRepo.list({
    isDraft: false,
    orderBy: 'createdAt',
    orderDir: 'desc',
  })

  const kw = normalizedKeyword.toLocaleLowerCase()
  const results: SearchResult[] = []

  for (const entry of entries) {
    if (!entryMatchesSearchDate(entry, dateFilter)) continue

    const matches: SearchResult['matches'] = []
    let score = 0
    const title = entry.title || ''
    const tags = entry.tags || []
    if (tag && !tags.includes(tag)) continue

    if (kw && entry.content.toLocaleLowerCase().includes(kw)) {
      const idx = entry.content.toLocaleLowerCase().indexOf(kw)
      const start = Math.max(0, idx - 30)
      const end = Math.min(entry.content.length, idx + kw.length + 30)
      let snippet = entry.content.slice(start, end)
      if (start > 0) snippet = '…' + snippet
      if (end < entry.content.length) snippet += '…'
      matches.push({ field: 'content', snippet })
      score += 10
    }

    if (kw && title.toLocaleLowerCase().includes(kw)) {
      matches.push({ field: 'title', snippet: title })
      score += 5
    }

    const matchedTag = kw ? tags.find((tag) => tag.toLocaleLowerCase().includes(kw)) : undefined
    if (matchedTag) {
      matches.push({ field: 'tags', snippet: matchedTag })
      score += 3
    }

    if (!kw || matches.length > 0) {
      results.push({ entry, matches, score })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
