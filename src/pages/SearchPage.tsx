import { Fragment, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { entryRepo } from '../db/repository'
import {
  NO_DATE_FILTER,
  formatSearchDateFilter,
  searchEntries,
  type SearchDateFilter,
  type SearchResult,
} from '../services/search'
import type { TagInfo, Entry, CreateEntryInput } from '../db/models'
import { CalendarIcon, SearchIcon, TagIcon, XIcon } from '../components/Icons'
import { EntryEditor } from '../components/EntryEditor'
import { SearchDateFilterPanel } from '../components/SearchDateFilter'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/ToastContext'
import { formatLocalDateString, toLocalDate } from '../utils/date'

function highlight(text: string, keyword: string): ReactNode {
  const query = keyword.trim()
  if (!query) return text
  const lower = text.toLocaleLowerCase()
  const needle = query.toLocaleLowerCase()
  const nodes: ReactNode[] = []
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index >= 0) {
    if (index > cursor) nodes.push(text.slice(cursor, index))
    nodes.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + query.length)}</mark>)
    cursor = index + query.length
    index = lower.indexOf(needle, cursor)
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

export function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [tags, setTags] = useState<TagInfo[]>([])
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set())
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<SearchDateFilter>(NO_DATE_FILTER)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()
  const deferredKeyword = useDeferredValue(keyword.trim())

  const loadMeta = async () => {
    const [nextTags, dates] = await Promise.all([
      entryRepo.getAllTags(),
      entryRepo.getDatesWithEntries(),
    ])
    setTags(nextTags)
    setDatesWithEntries(new Set(dates))
  }

  useEffect(() => {
    void loadMeta()
  }, [])

  useEffect(() => {
    let cancelled = false
    const hasCriteria = Boolean(deferredKeyword || selectedTag || dateFilter.mode !== 'all')
    if (!hasCriteria) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    void searchEntries(deferredKeyword, selectedTag || undefined, dateFilter)
      .then((nextResults) => {
        if (cancelled) return
        setResults(nextResults)
        setSearching(false)
      })
      .catch(() => {
        if (cancelled) return
        setResults([])
        setSearching(false)
      })
    return () => { cancelled = true }
  }, [deferredKeyword, selectedTag, dateFilter])

  const hasKeyword = Boolean(deferredKeyword)

  // When keyword present: flat list by relevance + createdAt tiebreaker
  // When no keyword: grouped by date, sorted by createdAt desc
  const sortedResults = useMemo(() => {
    if (hasKeyword) {
      return [...results].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return b.entry.createdAt.localeCompare(a.entry.createdAt)
      })
    }
    return [...results].sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt))
  }, [results, hasKeyword])

  const groupedResults = useMemo(() => {
    if (hasKeyword) return null // No grouping when keyword present
    const groups = new Map<string, SearchResult[]>()
    for (const result of sortedResults) {
      const date = toLocalDate(result.entry.createdAt)
      const items = groups.get(date)
      if (items) items.push(result)
      else groups.set(date, [result])
    }
    return [...groups.entries()]
  }, [sortedResults, hasKeyword])

  const dateFilterLabel = useMemo(() => formatSearchDateFilter(dateFilter), [dateFilter])
  const hasCriteria = Boolean(keyword.trim() || selectedTag || dateFilter.mode !== 'all')
  const searchContext = [
    keyword.trim() ? `"${keyword.trim()}"` : null,
    selectedTag ? `#${selectedTag}` : null,
    dateFilterLabel,
  ].filter(Boolean).join(' · ')

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    const [nextResults, nextTags, dates] = await Promise.all([
      searchEntries(keyword.trim(), selectedTag || undefined, dateFilter),
      entryRepo.getAllTags(),
      entryRepo.getDatesWithEntries(),
    ])
    setResults(nextResults)
    setTags(nextTags)
    setDatesWithEntries(new Set(dates))
    setEditingEntry(null)
    showToast('日记已更新', 'success')
  }

  return (
    <main className="page search-page">
      <div className="page-heading"><h1>搜索</h1><p>在本机找回写过的片段</p></div>
      <div className="search-tools">
        <div className="search-field">
          <SearchIcon />
          <label className="sr-only" htmlFor="journal-search">搜索日记</label>
          <input id="journal-search" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索日记正文、标题或标签" autoComplete="off" />
          {keyword ? <button type="button" className="icon-button" aria-label="清除搜索" onClick={() => setKeyword('')}><XIcon /></button> : null}
          <button
            type="button"
            className={`icon-button search-date-trigger ${selectedTag ? 'active' : ''}`}
            aria-label="按标签筛选"
            aria-pressed={Boolean(selectedTag)}
            onClick={() => setTagFilterOpen((open) => !open)}
          >
            <TagIcon />
          </button>
          <button
            type="button"
            className={`icon-button search-date-trigger ${dateFilter.mode !== 'all' ? 'active' : ''}`}
            aria-label="按日期筛选"
            aria-pressed={dateFilter.mode !== 'all'}
            onClick={() => setDateFilterOpen((open) => !open)}
          >
            <CalendarIcon />
          </button>
        </div>

        {tagFilterOpen ? (
          <>
            <button type="button" className="search-date-scrim" aria-label="关闭标签筛选" onClick={() => setTagFilterOpen(false)} />
            <section className="search-date-panel" role="dialog" aria-modal="true" aria-labelledby="tag-filter-title">
              <header className="search-date-header">
                <div>
                  <h2 id="tag-filter-title">选择标签</h2>
                  <p>{selectedTag ? `已选: #${selectedTag}` : '单选一个标签筛选'}</p>
                </div>
                <button type="button" className="icon-button" aria-label="关闭标签筛选" onClick={() => setTagFilterOpen(false)}><XIcon /></button>
              </header>
              <div className="tag-filter-list">
                {tags.length === 0 ? (
                  <p className="date-filter-all-copy">暂无标签。</p>
                ) : (
                  tags.map((tag) => (
                    <button
                      type="button"
                      key={tag.name}
                      className={`tag-filter-option ${selectedTag === tag.name ? 'active' : ''}`}
                      aria-pressed={selectedTag === tag.name}
                      onClick={() => {
                        setSelectedTag(selectedTag === tag.name ? null : tag.name)
                        setTagFilterOpen(false)
                      }}
                    >
                      <span>#{tag.name}</span>
                      <span>{tag.count}</span>
                    </button>
                  ))
                )}
              </div>
              <footer className="search-date-actions">
                {selectedTag ? (
                  <button type="button" className="btn btn-ghost" onClick={() => { setSelectedTag(null); setTagFilterOpen(false) }}>
                    清除标签
                  </button>
                ) : null}
                <button type="button" className="btn btn-primary" onClick={() => setTagFilterOpen(false)}>
                  完成
                </button>
              </footer>
            </section>
          </>
        ) : null}

        {dateFilterOpen ? (
          <SearchDateFilterPanel
            value={dateFilter}
            datesWithEntries={datesWithEntries}
            onClose={() => setDateFilterOpen(false)}
            onApply={(filter) => {
              setDateFilter(filter)
              setDateFilterOpen(false)
            }}
          />
        ) : null}
      </div>

      {/* Active filters display */}
      {(selectedTag || dateFilterLabel) ? (
        <div className="search-active-filters">
          {selectedTag ? (
            <div className="search-active-filter">
              <TagIcon />
              <span>#{selectedTag}</span>
              <button type="button" className="icon-button" aria-label="清除标签筛选" onClick={() => setSelectedTag(null)}><XIcon /></button>
            </div>
          ) : null}
          {dateFilterLabel ? (
            <div className="search-active-filter">
              <CalendarIcon />
              <span>{dateFilterLabel}</span>
              <button type="button" className="icon-button" aria-label="清除日期筛选" onClick={() => setDateFilter(NO_DATE_FILTER)}><XIcon /></button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="search-results" aria-live="polite">
        {searching ? <p className="timeline-empty">正在本机搜索…</p> : null}
        {!searching && !hasCriteria ? <p className="search-hint">输入一个词、选择标签，或按日期回到某段时间。搜索只在当前设备中进行。</p> : null}
        {!searching && results.length > 0 && hasCriteria ? <p className="search-context">{searchContext} · {results.length} 条记录</p> : null}
        {!searching && results.length === 0 && hasCriteria ? (
          <p className="timeline-empty">
            {dateFilter.mode !== 'all'
              ? keyword.trim() || selectedTag
                ? '当前日期范围内没有匹配关键词的记录。'
                : '当前日期范围内没有记录。'
              : '没有找到匹配关键词的记录。'}
          </p>
        ) : null}
        {!searching && hasKeyword ? sortedResults.map((result) => (
          <button type="button" className="search-result search-result-keyword" key={result.entry.id} onClick={() => setViewingEntry(result.entry)}>
            <time>
              <span className="search-result-date">{new Date(result.entry.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
              <span className="search-result-time">{new Date(result.entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            </time>
            <span className="search-result-body">
              {result.entry.title ? <strong>{highlight(result.entry.title, keyword)}</strong> : null}
              <span>{highlight(result.matches.find((match) => match.field === 'content')?.snippet || result.entry.content.slice(0, 120), keyword)}</span>
              {result.entry.tags.length ? <small>{result.entry.tags.map((tag) => `#${tag}`).join('  ')}</small> : null}
            </span>
          </button>
        )) : null}
        {!searching && !hasKeyword && groupedResults ? groupedResults.map(([date, dayResults]) => (
          <Fragment key={date}>
            <div className="date-divider"><span>{formatLocalDateString(date, { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            {dayResults.map((result) => (
              <button type="button" className="search-result" key={result.entry.id} onClick={() => setViewingEntry(result.entry)}>
                <time>{new Date(result.entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
                <span className="search-result-body">
                  {result.entry.title ? <strong>{highlight(result.entry.title, keyword)}</strong> : null}
                  <span>{highlight(result.matches.find((match) => match.field === 'content')?.snippet || result.entry.content.slice(0, 120), keyword)}</span>
                  {result.entry.tags.length ? <small>{result.entry.tags.map((tag) => `#${tag}`).join('  ')}</small> : null}
                </span>
              </button>
            ))}
          </Fragment>
        )) : null}
      </section>

      {viewingEntry ? (
        <div className="modal-overlay" onClick={() => setViewingEntry(null)}>
          <article className="modal entry-detail" role="dialog" aria-modal="true" aria-label="日记详情" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header"><time>{new Date(viewingEntry.createdAt).toLocaleString('zh-CN')}</time><button type="button" className="icon-button" aria-label="关闭详情" onClick={() => setViewingEntry(null)}><XIcon /></button></header>
            {viewingEntry.title ? <h2>{viewingEntry.title}</h2> : null}
            <p>{viewingEntry.content}</p>
            {viewingEntry.tags.length ? <div className="entry-tags">{viewingEntry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
            <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setViewingEntry(null)}>关闭</button><button type="button" className="btn btn-primary" onClick={() => { setEditingEntry(viewingEntry); setViewingEntry(null) }}>编辑</button></div>
          </article>
        </div>
      ) : null}
      {editingEntry ? <EntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} /> : null}
    </main>
  )
}