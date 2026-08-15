import { useMemo, useState } from 'react'
import { Calendar } from '../components/Calendar'
import { EntryCard } from '../components/EntryCard'
import { LazyEntryEditor } from '../components/LazyEntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEntryStore } from '../store/entryStore'
import { useEntriesForDate, useMonthEntryDates } from '../db/live'
import { useEntryActions } from '../hooks/useEntryActions'
import { useToast } from '../components/ToastContext'
import { formatLocalDateString, parseLocalDateString } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

export function CalendarPage() {
  // Subscribing to todayDate keeps the calendar's "today" mark and the
  // initial selection correct when the app stays open across midnight.
  const todayDate = useEntryStore((state) => state.todayDate)
  const initialToday = parseLocalDateString(todayDate)
  const [year, setYear] = useState(initialToday.getFullYear())
  const [month, setMonth] = useState(initialToday.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayDate)
  const monthDates = useMonthEntryDates(year, month)
  const datesWithEntries = useMemo(() => new Set(monthDates), [monthDates])
  const selectedEntries = useEntriesForDate(selectedDate) ?? []
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { deletingEntry, requestDelete, cancelDelete, confirmDelete } = useEntryActions()
  const { updateEntry } = useEntryStore()
  const { showToast } = useToast()

  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
  }

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    showToast('日记已更新', 'success')
  }

  return (
    <main className="page calendar-page">
      <div className="page-heading"><h1>日历</h1><p>按日期回到某一天</p></div>
      <div className="calendar-layout">
        <Calendar year={year} month={month} today={todayDate} datesWithEntries={datesWithEntries} selectedDate={selectedDate} onSelectDate={setSelectedDate} onPrevMonth={() => moveMonth(-1)} onNextMonth={() => moveMonth(1)} />
        <section className="calendar-entries" aria-live="polite">
          {selectedDate ? <div className="date-divider"><span>{formatLocalDateString(selectedDate, { month: 'long', day: 'numeric', weekday: 'long' })}</span></div> : <p className="timeline-empty">选择一个日期，查看那天的记录。</p>}
          {selectedDate && selectedEntries.length === 0 ? <p className="timeline-empty">这一天没有记录。</p> : null}
          {selectedEntries.map((entry) => <EntryCard key={entry.id} entry={entry} onEdit={setEditingEntry} onDelete={requestDelete} onCopied={() => showToast('已复制到剪贴板', 'success')} />)}
        </section>
      </div>
      {editingEntry ? <LazyEntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} /> : null}
      {deletingEntry ? <ConfirmDialog message="确定要删除这条日记吗？删除后可前往回收站恢复。" confirmLabel="删除" danger onConfirm={() => void confirmDelete()} onCancel={cancelDelete} /> : null}
    </main>
  )
}
