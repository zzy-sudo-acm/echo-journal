import { useEffect, useState } from 'react'
import { entryRepo } from '../db/repository'
import { Calendar } from '../components/Calendar'
import { EntryCard } from '../components/EntryCard'
import { EntryEditor } from '../components/EntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/ToastContext'
import { getLocalDateString } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

export function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(getLocalDateString(today))
  const [selectedEntries, setSelectedEntries] = useState<Entry[]>([])
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set())
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const { updateEntry, deleteEntry } = useEntryStore()
  const { showToast } = useToast()

  const loadDates = async () => setDatesWithEntries(new Set(await entryRepo.getDatesWithEntries()))
  const loadSelected = async (date: string | null) => {
    if (!date) return setSelectedEntries([])
    setSelectedEntries(await entryRepo.list({ date, isDraft: false, orderBy: 'createdAt', orderDir: 'asc' }))
  }

  useEffect(() => { void loadDates() }, [])
  useEffect(() => { void loadSelected(selectedDate) }, [selectedDate])

  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    setSelectedDate(null)
  }

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    await Promise.all([loadSelected(selectedDate), loadDates()])
    showToast('日记已更新', 'success')
  }

  const handleDelete = async () => {
    if (!deletingEntry) return
    await deleteEntry(deletingEntry.id)
    setDeletingEntry(null)
    await Promise.all([loadSelected(selectedDate), loadDates()])
    showToast('日记已删除', 'success')
  }

  return (
    <main className="page calendar-page">
      <div className="page-heading"><h1>日历</h1><p>按日期回到某一天</p></div>
      <div className="calendar-layout">
        <Calendar year={year} month={month} datesWithEntries={datesWithEntries} selectedDate={selectedDate} onSelectDate={setSelectedDate} onPrevMonth={() => moveMonth(-1)} onNextMonth={() => moveMonth(1)} />
        <section className="calendar-entries" aria-live="polite">
          {selectedDate ? <div className="date-divider"><span>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span></div> : <p className="timeline-empty">选择一个日期，查看那天的记录。</p>}
          {selectedDate && selectedEntries.length === 0 ? <p className="timeline-empty">这一天没有记录。</p> : null}
          {selectedEntries.map((entry) => <EntryCard key={entry.id} entry={entry} onEdit={setEditingEntry} onDelete={setDeletingEntry} onCopied={() => showToast('已复制到剪贴板', 'success')} />)}
        </section>
      </div>
      {editingEntry ? <EntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} /> : null}
      {deletingEntry ? <ConfirmDialog message="确定要删除这条日记吗？" confirmLabel="删除" danger onConfirm={() => void handleDelete()} onCancel={() => setDeletingEntry(null)} /> : null}
    </main>
  )
}
