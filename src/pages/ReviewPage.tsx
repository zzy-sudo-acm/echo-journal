import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { entryRepo } from '../db/repository'
import { EntryCard } from '../components/EntryCard'
import { EntryEditor } from '../components/EntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/ToastContext'
import { getLocalDateString, toLocalDate } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

export function ReviewPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const undoGuardRef = useRef(false)
  const { updateEntry, deleteEntry, restoreEntry } = useEntryStore()
  const { showToast } = useToast()
  const today = new Date()
  const month = today.getMonth()
  const day = today.getDate()

  const loadReview = useCallback(async () => {
    const found = await entryRepo.getOnThisDay(month, day)
    const todayString = getLocalDateString()
    setEntries(found.filter((entry) => toLocalDate(entry.createdAt) !== todayString))
  }, [month, day])

  useEffect(() => { void loadReview() }, [loadReview])

  const byYear = useMemo(() => {
    const groups = new Map<number, Entry[]>()
    for (const entry of entries) {
      const year = new Date(entry.createdAt).getFullYear()
      const items = groups.get(year)
      if (items) items.push(entry)
      else groups.set(year, [entry])
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0])
  }, [entries])

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    await loadReview()
    showToast('日记已更新', 'success')
  }

  const handleDelete = async () => {
    if (!deletingEntry || deleting) return
    const deletedId = deletingEntry.id
    setDeleting(true)
    try {
      await deleteEntry(deletedId)
      setDeletingEntry(null)
      await loadReview()
      showToast('已移入回收站', 'success', {
        label: '撤销',
        action: async () => {
          if (undoGuardRef.current) return
          undoGuardRef.current = true
          try {
            await restoreEntry(deletedId)
            await loadReview()
          } catch {
            showToast('恢复失败', 'error')
          } finally {
            undoGuardRef.current = false
          }
        },
      })
    } catch {
      showToast('删除失败', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="page review-page">
      <div className="page-heading"><h1>过去的今天</h1><p>{today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}，看看时间留下的回声</p></div>
      {byYear.length === 0 ? <p className="timeline-empty review-empty">过去的今天还没有记录。继续写下此刻，未来会在这里相遇。</p> : byYear.map(([year, yearEntries]) => (
        <Fragment key={year}>
          <div className="date-divider"><span>{year} 年</span></div>
          {yearEntries.map((entry) => <EntryCard key={entry.id} entry={entry} onEdit={setEditingEntry} onDelete={setDeletingEntry} onCopied={() => showToast('已复制到剪贴板', 'success')} />)}
        </Fragment>
      ))}
      {editingEntry ? <EntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} /> : null}
      {deletingEntry ? <ConfirmDialog message="确定要删除这条日记吗？删除后可前往回收站恢复。" confirmLabel="删除" danger confirming={deleting} onConfirm={() => void handleDelete()} onCancel={() => { if (!deleting) setDeletingEntry(null) }} /> : null}
    </main>
  )
}
