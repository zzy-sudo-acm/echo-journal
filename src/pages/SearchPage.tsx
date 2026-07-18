import { useState, useEffect } from 'react'
import { entryRepo } from '../db/repository'
import { searchEntries } from '../services/search'
import type { SearchResult } from '../services/search'
import type { TagInfo, Entry } from '../db/models'
import { SearchIcon } from '../components/Icons'
import { EntryEditor } from '../components/EntryEditor'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/Toast'
import type { CreateEntryInput } from '../db/models'

export function SearchPage() {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [tags, setTags] = useState<TagInfo[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()

  useEffect(() => {
    entryRepo.getAllTags().then(setTags)
  }, [])

  useEffect(() => {
    if (!keyword.trim() && !selectedTag) {
      setResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const r = await searchEntries(keyword.trim(), selectedTag || undefined)
      setResults(r)
      setSearching(false)
    }, 200)
    return () => clearTimeout(timer)
  }, [keyword, selectedTag])

  const handleUpdate = async (input: CreateEntryInput) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, input)
      showToast('日记已更新', 'success')
      setEditingEntry(null)
      // Refresh results
      entryRepo.getAllTags().then(setTags)
    }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>搜索</h1>

      <div className="search-input">
        <div className="search-input-wrapper">
          <SearchIcon />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索日记正文、标题或标签…"
            autoComplete="off"
          />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tag-filter">
          <span
            className={`tag ${!selectedTag ? 'active' : ''}`}
            onClick={() => setSelectedTag(null)}
          >
            全部
          </span>
          {tags.map((tag) => (
            <span
              key={tag.name}
              className={`tag ${selectedTag === tag.name ? 'active' : ''}`}
              onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
            >
              {tag.name} ({tag.count})
            </span>
          ))}
        </div>
      )}

      {searching ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>搜索中…</p>
      ) : results.length === 0 && (keyword.trim() || selectedTag) ? (
        <div className="empty-state">
          <p>没有找到匹配的记录</p>
        </div>
      ) : (
        results.map((r) => {
          const date = new Date(r.entry.createdAt).toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
          })
          const time = new Date(r.entry.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div
              key={r.entry.id}
              className="search-result"
              onClick={() => setEditingEntry(r.entry)}
              style={{ cursor: 'pointer' }}
            >
              <div className="search-result-date">
                {date} · {time}
              </div>
              {r.entry.title && <div className="entry-title">{r.entry.title}</div>}
              {r.matches.map((m, i) => (
                <div key={i} className="search-snippet">
                  {m.field === 'content' && m.snippet}
                  {m.field === 'title' && `标题: ${m.snippet}`}
                  {m.field === 'tags' && `标签: ${m.snippet}`}
                </div>
              ))}
              {r.entry.tags.length > 0 && (
                <div className="entry-tags">
                  {r.entry.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {editingEntry && (
        <EntryEditor
          entry={editingEntry}
          onSave={handleUpdate}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
