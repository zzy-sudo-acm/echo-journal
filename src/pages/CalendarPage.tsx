import { useState, useEffect } from 'react'
import { entryRepo } from '../db/repository'
import { Calendar } from '../components/Calendar'
import { EntryCard } from '../components/EntryCard'
import { EntryEditor } from '../components/EntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/Toast'
import type { Entry, CreateEntryInput } from '../db/models'

export function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<Entry[]>([])
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set())
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const { updateEntry, deleteEntry } = useEntryStore()
  const { showToast } = useToast()

  useEffect(() => {
    entryRepo.getDatesWithEntries().then((dates) => {
      setDatesWithEntries(new Set(dates))
    })
  }, [])

  useEffect(() => {
    if (selectedDate) {
      entryRepo.list({ date: selectedDate, isDraft: false, orderBy: 'createdAt', orderDir: 'desc' })
        .then(setSelectedEntries)
    } else {
      setSelectedEntries([])
    }
  }, [selectedDate])

  const handleSelectDate = (date: string) => {
    setSelectedDate(date === selectedDate ? null : date)
  }

  const handlePrevMonth = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
    setSelectedDate(null)
  }

  const handleUpdate = async (input: CreateEntryInput) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, input)
      showToast('日记已更新', 'success')
      if (selectedDate) {
        entryRepo.list({ date: selectedDate, isDraft: false, orderBy: 'createdAt', orderDir: 'desc' })
          .then(setSelectedEntries)
      }
      entryRepo.getDatesWithEntries().then((dates) => setDatesWithEntries(new Set(dates)))
    }
  }

  const handleDelete = async () => {
    if (deletingEntry) {
      await deleteEntry(deletingEntry.id)
      showToast('日记已删除', 'success')
      setDeletingEntry(null)
      if (selectedDate) {
        entryRepo.list({ date: selectedDate, isDraft: false, orderBy: 'createdAt', orderDir: 'desc' })
          .then(setSelectedEntries)
      }
      entryRepo.getDatesWithEntries().then((dates) => setDatesWithEntries(new Set(dates)))
    }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>日历</h1>

      <Calendar
        year={year}
        month={month}
        datesWithEntries={datesWithEntries}
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {selectedDate && (
        <div style={{ marginTop: 24 }}>
          <div className="section-title">
            {new Date(selectedDate).toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </div>
          {selectedEntries.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '16px 0' }}>
              这一天没有记录
            </p>
          ) : (
            selectedEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={(e) => { setEditingEntry(e); setShowEditor(true) }}
                onDelete={setDeletingEntry}
              />
            ))
          )}
        </div>
      )}

      {showEditor && (
        <EntryEditor
          entry={editingEntry}
          onSave={handleUpdate}
          onClose={() => { setShowEditor(false); setEditingEntry(null) }}
        />
      )}

      {deletingEntry && (
        <ConfirmDialog
          message="确定要删除这条日记吗？"
          confirmLabel="删除"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  )
}
