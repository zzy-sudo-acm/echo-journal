import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { entryRepo } from '../db/repository'
import { searchEntries, type SearchResult } from '../services/search'
import type { TagInfo, Entry, CreateEntryInput } from '../db/models'
import { SearchIcon, XIcon } from '../components/Icons'
import { EntryEditor } from '../components/EntryEditor'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/ToastContext'
import { toLocalDate } from '../utils/date'

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
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()

  useEffect(() => { void entryRepo.getAllTags().then(setTags) }, [])

  useEffect(() => {
    if (!keyword.trim() && !selectedTag) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      setResults(await searchEntries(keyword.trim(), selectedTag || undefined))
      setSearching(false)
    }, 180)
    return () => clearTimeout(timer)
  }, [keyword, selectedTag])

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

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    setResults(await searchEntries(keyword.trim(), selectedTag || undefined))
    setTags(await entryRepo.getAllTags())
    setEditingEntry(null)
    showToast('日记已更新', 'success')
  }

  return (
    <main className="page search-page">
      <div className="page-heading"><h1>搜索</h1><p>在本机找回写过的片段</p></div>
      <label className="search-field">
        <SearchIcon />
        <span className="sr-only">搜索日记</span>
        <input type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索日记正文、标题或标签" autoComplete="off" />
        {keyword ? <button type="button" className="icon-button" aria-label="清除搜索" onClick={() => setKeyword('')}><XIcon /></button> : null}
      </label>

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
        {!searching && !keyword.trim() && !selectedTag ? <p className="search-hint">输入一个词，或选择标签。搜索只在当前设备中进行。</p> : null}
        {!searching && results.length === 0 && (keyword.trim() || selectedTag) ? <p className="timeline-empty">没有找到匹配的记录。</p> : null}
        {!searching ? groupedResults.map(([date, dayResults]) => (
          <Fragment key={date}>
            <div className="date-divider"><span>{new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
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
