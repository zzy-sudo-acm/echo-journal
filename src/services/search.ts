import { entryRepo } from '../db/repository'
import type { Entry } from '../db/models'
import { formatLocalDateString, toLocalDate } from '../utils/date'

export type SearchDateFilter =
  | { mode: 'all' }
  | { mode: 'day'; date: string }
  | { mode: 'month'; year: number; month: number }
  | { mode: 'range'; start: string; end: string }

export const NO_DATE_FILTER: SearchDateFilter = { mode: 'all' }

function formatLocalDate(date: string, includeYear = true): string {
  return formatLocalDateString(date, {
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

    if (kw) {
      // Pre-compute lowercased values once per entry
      const titleLower = title.toLocaleLowerCase()
      const contentLower = entry.content.toLocaleLowerCase()

      // Title exact match (highest priority)
      if (titleLower === kw) {
        matches.push({ field: 'title', snippet: title })
        score += 30
      } else if (titleLower.includes(kw)) {
        matches.push({ field: 'title', snippet: title })
        score += 20
      }

      // Content match
      if (contentLower.includes(kw)) {
        const idx = contentLower.indexOf(kw)
        const start = Math.max(0, idx - 30)
        const end = Math.min(entry.content.length, idx + kw.length + 30)
        let snippet = entry.content.slice(start, end)
        if (start > 0) snippet = '…' + snippet
        if (end < entry.content.length) snippet += '…'
        matches.push({ field: 'content', snippet })
        score += 10
      }

      // Tag exact match
      if (tags.some((t) => t.toLocaleLowerCase() === kw)) {
        const matchedTag = tags.find((t) => t.toLocaleLowerCase() === kw)!
        matches.push({ field: 'tags', snippet: matchedTag })
        score += 8
      } else {
        // Tag partial match
        const matchedTag = tags.find((t) => t.toLocaleLowerCase().includes(kw))
        if (matchedTag) {
          matches.push({ field: 'tags', snippet: matchedTag })
          score += 3
        }
      }
    }

    if (!kw || matches.length > 0) {
      results.push({ entry, matches, score })
    }
  }

  // Sort by score desc, then by createdAt desc as tiebreaker
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.entry.createdAt.localeCompare(a.entry.createdAt)
  })
  return results
}
