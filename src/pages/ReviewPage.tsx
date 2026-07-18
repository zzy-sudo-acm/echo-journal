import { useState, useEffect } from 'react'
import { entryRepo } from '../db/repository'
import { EntryEditor } from '../components/EntryEditor'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/Toast'
import { ClockIcon } from '../components/Icons'
import type { Entry, CreateEntryInput } from '../db/models'

export function ReviewPage() {
  const [onThisDayEntries, setOnThisDayEntries] = useState<Entry[]>([])
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()

  const today = new Date()
  const month = today.getMonth()
  const day = today.getDate()

  useEffect(() => {
    entryRepo.getOnThisDay(month, day).then((entries) => {
      // Filter out today
      const todayStr = today.toISOString().slice(0, 10)
      setOnThisDayEntries(entries.filter((e) => !e.createdAt.startsWith(todayStr)))
    })
  }, [month, day])

  const handleUpdate = async (input: CreateEntryInput) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, input)
      showToast('日记已更新', 'success')
      setEditingEntry(null)
    }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>回顾</h1>

      <div className="section-title">
        <ClockIcon />
        <span style={{ marginLeft: 8 }}>过去的今天</span>
      </div>

      {onThisDayEntries.length === 0 ? (
        <div className="empty-state">
          <p>过去的今天没有记录</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            坚持记录，未来的某天你会在这里看到今天的回忆
          </p>
        </div>
      ) : (
        onThisDayEntries.map((entry) => {
          const entryDate = new Date(entry.createdAt)
          const year = entryDate.getFullYear()
          const dateStr = entryDate.toLocaleDateString('zh-CN', {
            month: 'long',
            day: 'numeric',
          })
          const time = entryDate.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })

          return (
            <div
              key={entry.id}
              className="entry-card"
              onClick={() => setEditingEntry(entry)}
              style={{ cursor: 'pointer' }}
            >
              <div className="entry-time">
                {year}年{dateStr} · {time}
              </div>
              {entry.title && <div className="entry-title">{entry.title}</div>}
              <div className="entry-content">
                {entry.content.length > 200
                  ? entry.content.slice(0, 200) + '…'
                  : entry.content}
              </div>
              {entry.tags.length > 0 && (
                <div className="entry-tags">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      <div style={{ marginTop: 40 }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          每天记录一点，时间会给你回声。
        </p>
      </div>

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
