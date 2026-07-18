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
import { CalendarIcon, SearchIcon, XIcon } from '../components/Icons'
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
  const [searching, setSearching] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()
  const deferredKeyword = useDeferredValue(keyword.trim())

  useEffect(() => {
    let cancelled = false
    void Promise.all([entryRepo.getAllTags(), entryRepo.getDatesWithEntries()]).then(([nextTags, dates]) => {
      if (cancelled) return
      setTags(nextTags)
      setDatesWithEntries(new Set(dates))
    })
    return () => { cancelled = true }
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

  const groupedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt))
    const groups = new Map<string, SearchResult[]>()
    for (const result of sorted) {
      const date = toLocalDate(result.entry.createdAt)
      const items = groups.get(date)
      if (items) items.push(result)
      else groups.set(date, [result])
    }
    return [...groups.entries()]
  }, [results])

  const dateFilterLabel = useMemo(() => formatSearchDateFilter(dateFilter), [dateFilter])
  const hasCriteria = Boolean(keyword.trim() || selectedTag || dateFilter.mode !== 'all')
  const searchContext = [
    keyword.trim() ? `“${keyword.trim()}”` : null,
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
            className={`icon-button search-date-trigger ${dateFilter.mode !== 'all' ? 'active' : ''}`}
            aria-label="按日期筛选"
            aria-pressed={dateFilter.mode !== 'all'}
            onClick={() => setDateFilterOpen((open) => !open)}
          >
            <CalendarIcon />
          </button>
        </div>

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

      {dateFilterLabel ? (
        <div className="search-active-filter">
          <CalendarIcon />
          <span>{dateFilterLabel}</span>
          <button type="button" className="icon-button" aria-label="清除日期筛选" onClick={() => setDateFilter(NO_DATE_FILTER)}><XIcon /></button>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <section className="recent-tags" aria-label="最近标签">
          <div className="subsection-heading"><span>标签</span>{selectedTag ? <button type="button" onClick={() => setSelectedTag(null)}>清除</button> : null}</div>
          <div className="tag-filter">
            {tags.slice(0, 10).map((tag) => (
              <button type="button" key={tag.name} className={selectedTag === tag.name ? 'active' : ''} aria-pressed={selectedTag === tag.name} onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}>
                #{tag.name}<span>{tag.count}</span>
              </button>
            ))}
          </div>
        </section>
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
        {!searching ? groupedResults.map(([date, dayResults]) => (
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
