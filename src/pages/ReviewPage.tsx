import { Fragment, useMemo, useState } from 'react'
import { EntryCard } from '../components/EntryCard'
import { LazyEntryEditor } from '../components/LazyEntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEntryStore } from '../store/entryStore'
import { useOnThisDayEntries } from '../db/live'
import { useEntryActions } from '../hooks/useEntryActions'
import { useToast } from '../components/ToastContext'
import { getLocalDateString, toLocalDate } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

export function ReviewPage() {
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { deletingEntry, requestDelete, cancelDelete, confirmDelete } = useEntryActions()
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()
  const today = new Date()
  const month = today.getMonth()
  const day = today.getDate()

  const onThisDayEntries = useOnThisDayEntries(month, day)

  const entries = useMemo(() => {
    const todayString = getLocalDateString()
    return (onThisDayEntries ?? []).filter((entry) => toLocalDate(entry.createdAt) !== todayString)
  }, [onThisDayEntries])

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
    try {
      await updateEntry(editingEntry.id, input)
      showToast('日记已更新', 'success')
    } catch {
      showToast('更新失败', 'error')
    }
  }

  return (
    <main className="page review-page">
      <div className="page-heading"><h1>过去的今天</h1><p>{today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}，看看时间留下的回声</p></div>
      {byYear.length === 0 ? <p className="timeline-empty review-empty">过去的今天还没有记录。继续写下此刻，未来会在这里相遇。</p> : byYear.map(([year, yearEntries]) => (
        <Fragment key={year}>
          <div className="date-divider"><span>{year} 年</span></div>
          {yearEntries.map((entry) => <EntryCard key={entry.id} entry={entry} onEdit={setEditingEntry} onDelete={requestDelete} onCopied={() => showToast('已复制到剪贴板', 'success')} />)}
        </Fragment>
      ))}
      {editingEntry ? <LazyEntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} /> : null}
      {deletingEntry ? <ConfirmDialog message="确定要删除这条日记吗？删除后可前往回收站恢复。" confirmLabel="删除" danger onConfirm={() => void confirmDelete()} onCancel={cancelDelete} /> : null}
    </main>
  )
}
