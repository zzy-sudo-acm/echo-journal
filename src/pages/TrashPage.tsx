import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { entryRepo } from '../db/repository'
import { useEntryStore } from '../store/entryStore'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/ToastContext'
import { ChevronLeftIcon, TrashIcon } from '../components/Icons'
import { formatLocalDateString, toLocalDate } from '../utils/date'
import type { Entry } from '../db/models'

export function TrashPage() {
  const [trashEntries, setTrashEntries] = useState<Entry[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [emptying, setEmptying] = useState(false)
  const { restoreEntry, permanentDeleteEntry, emptyTrash, loadToday } = useEntryStore()
  const { showToast } = useToast()

  const loadTrash = useCallback(async () => {
    setTrashEntries(await entryRepo.listTrash())
  }, [])

  useEffect(() => { void loadTrash() }, [loadTrash])

  const groups = useMemo(() => {
    const grouped = new Map<string, Entry[]>()
    for (const entry of trashEntries) {
      const date = toLocalDate(entry.createdAt)
      const list = grouped.get(date)
      if (list) list.push(entry)
      else grouped.set(date, [entry])
    }
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a))
  }, [trashEntries])

  const handleRestore = async (id: string) => {
    setRestoringId(id)
    try {
      await restoreEntry(id)
      await loadTrash()
      await loadToday()
      showToast('日记已恢复', 'success')
    } catch {
      showToast('恢复失败', 'error')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    await permanentDeleteEntry(id)
    await loadTrash()
    showToast('已彻底删除', 'success')
  }

  const handleEmpty = async () => {
    await emptyTrash()
    await loadTrash()
    setEmptying(false)
    showToast('回收站已清空', 'success')
  }

  return (
    <main className="page trash-page">
      <div className="trash-header">
        <Link to="/settings" className="icon-button" aria-label="返回设置"><ChevronLeftIcon /></Link>
        <div>
          <h1>回收站</h1>
          <p>{trashEntries.length > 0 ? `${trashEntries.length} 条已删除的日记` : '回收站是空的。'}</p>
        </div>
        {trashEntries.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEmptying(true)}>
            <TrashIcon />清空回收站
          </button>
        ) : null}
      </div>

      {trashEntries.length === 0 ? (
        <p className="trash-empty">回收站是空的。</p>
      ) : (
        <div className="trash-list">
          {groups.map(([date, dayEntries]) => (
            <section key={date}>
              <div className="date-divider">
                <span>{formatLocalDateString(date, { month: 'long', day: 'numeric', weekday: 'long' })}</span>
              </div>
              {dayEntries.map((entry) => (
                <div key={entry.id} className="trash-entry">
                  <div className="trash-entry-main">
                    <time className="trash-entry-time">
                      {new Date(entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </time>
                    <div>
                      {entry.title ? <strong className="trash-entry-title">{entry.title}</strong> : null}
                      <p className="trash-entry-preview">{entry.content.slice(0, 120)}{entry.content.length > 120 ? '…' : ''}</p>
                      {entry.tags.length > 0 ? (
                        <div className="entry-tags">{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                      ) : null}
                    </div>
                  </div>
                  <div className="trash-entry-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={restoringId === entry.id}
                      onClick={() => void handleRestore(entry.id)}
                    >
                      {restoringId === entry.id ? '恢复中…' : '恢复'}
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-action"
                      aria-label="彻底删除"
                      onClick={() => setDeletingId(entry.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {deletingId ? (
        <ConfirmDialog
          message="确定要彻底删除这条日记吗？此操作不可撤销。"
          confirmLabel="彻底删除"
          danger
          onConfirm={() => { void handlePermanentDelete(deletingId); setDeletingId(null) }}
          onCancel={() => setDeletingId(null)}
        />
      ) : null}

      {emptying ? (
        <ConfirmDialog
          message={`确定要清空回收站吗？将彻底删除全部 ${trashEntries.length} 条日记，此操作不可撤销。`}
          confirmLabel="清空回收站"
          danger
          onConfirm={() => void handleEmpty()}
          onCancel={() => setEmptying(false)}
        />
      ) : null}
    </main>
  )
}