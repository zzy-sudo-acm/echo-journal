import { useEffect, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { QuickInput } from '../components/QuickInput'
import { EntryCard } from '../components/EntryCard'
import { EntryEditor } from '../components/EntryEditor'
import { OnThisDay } from '../components/OnThisDay'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import type { Entry, CreateEntryInput } from '../db/models'

export function TodayPage() {
  const { todayEntries, loadToday, createEntry, updateEntry, deleteEntry } = useEntryStore()
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    loadToday()
  }, [loadToday])

  const handleCreate = async (input: CreateEntryInput) => {
    await createEntry(input)
    showToast('日记已保存', 'success')
  }

  const handleUpdate = async (input: CreateEntryInput) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, input)
      showToast('日记已更新', 'success')
    }
  }

  const handleDelete = async () => {
    if (deletingEntry) {
      await deleteEntry(deletingEntry.id)
      showToast('日记已删除', 'success')
      setDeletingEntry(null)
    }
  }

  const handleEditClick = (entry: Entry) => {
    setEditingEntry(entry)
    setShowEditor(true)
  }

  const today = new Date()
  const dateStr = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>今天</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
        {dateStr}
      </p>

      <QuickInput />

      {todayEntries.length === 0 ? (
        <div className="empty-state">
          <p>今天还没有记录</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
            在上方输入框中写点什么吧
          </p>
        </div>
      ) : (
        <div>
          <div className="section-title">今日时间线</div>
          {todayEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleEditClick}
              onDelete={setDeletingEntry}
            />
          ))}
        </div>
      )}

      <OnThisDay onEntryClick={(entry) => {
        setEditingEntry(entry)
        setShowEditor(true)
      }} />

      {showEditor && (
        <EntryEditor
          entry={editingEntry}
          onSave={editingEntry ? handleUpdate : handleCreate}
          onClose={() => { setShowEditor(false); setEditingEntry(null) }}
        />
      )}

      {deletingEntry && (
        <ConfirmDialog
          message="确定要删除这条日记吗？此操作不可撤销。"
          confirmLabel="删除"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  )
}
