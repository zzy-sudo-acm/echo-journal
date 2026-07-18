import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { QuickInput } from '../components/QuickInput'
import { TimelineIntro } from '../components/TimelineIntro'
import { TimelineDayGroup, type TimelineDayVariant } from '../components/TimelineDayGroup'
import { EntryEditor } from '../components/EntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/ToastContext'
import { formatLocalDateString, getLocalDateString, parseLocalDateString, toLocalDate } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

function formatDateLabel(dateString: string) {
  const date = parseLocalDateString(dateString)
  const today = new Date()
  const todayString = getLocalDateString(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateString === todayString) return '今天'
  if (dateString === getLocalDateString(yesterday)) return '昨天'

  const label = formatLocalDateString(dateString, { month: 'long', day: 'numeric', weekday: 'long' })
  return date.getFullYear() === today.getFullYear() ? label : `${date.getFullYear()} 年 · ${label}`
}

export function TodayPage() {
  const { entries, loadEntries, updateEntry, deleteEntry } = useEntryStore()
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const { showToast } = useToast()
  const positioned = useRef(false)

  const refreshTimeline = useCallback(async () => {
    await loadEntries({ orderBy: 'createdAt', orderDir: 'asc' })
  }, [loadEntries])

  useEffect(() => {
    void refreshTimeline()
  }, [refreshTimeline])

  const today = getLocalDateString()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)

  const groups = useMemo(() => {
    const grouped = new Map<string, Entry[]>()
    for (const entry of entries) {
      const date = toLocalDate(entry.createdAt)
      const list = grouped.get(date)
      if (list) list.push(entry)
      else grouped.set(date, [entry])
    }
    const todayEntries = grouped.get(today) ?? []
    const earlierGroups = [...grouped.entries()]
      .filter(([date]) => date !== today)
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))

    return [[today, todayEntries] as const, ...earlierGroups]
  }, [entries, today])

  useEffect(() => {
    if (positioned.current || entries.length === 0) return
    positioned.current = true
    requestAnimationFrame(() => {
      document.getElementById(`day-${getLocalDateString()}`)?.scrollIntoView({ block: 'start' })
    })
  }, [entries])

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    await refreshTimeline()
    showToast('日记已更新', 'success')
  }

  const handleDelete = async () => {
    if (!deletingEntry) return
    await deleteEntry(deletingEntry.id)
    await refreshTimeline()
    showToast('日记已删除', 'success')
    setDeletingEntry(null)
  }

  return (
    <main className="page timeline-page">
      <TimelineIntro />

      <div className="timeline" aria-label="日记时间流">
        {groups.map(([date, dayEntries]) => {
          const variant: TimelineDayVariant = date === today
            ? 'today'
            : date === yesterday
              ? 'yesterday'
              : 'older'

          return (
            <TimelineDayGroup
              key={date}
              date={date}
              label={formatDateLabel(date)}
              variant={variant}
              entries={dayEntries}
              onEdit={setEditingEntry}
              onDelete={setDeletingEntry}
              onCopied={() => showToast('已复制到剪贴板', 'success')}
            >
              {variant === 'today' ? <QuickInput onSaved={refreshTimeline} /> : null}
            </TimelineDayGroup>
          )
        })}
      </div>

      {editingEntry ? (
        <EntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} />
      ) : null}

      {deletingEntry ? (
        <ConfirmDialog message="确定要删除这条日记吗？此操作不可撤销。" confirmLabel="删除" danger onConfirm={() => void handleDelete()} onCancel={() => setDeletingEntry(null)} />
      ) : null}
    </main>
  )
}
