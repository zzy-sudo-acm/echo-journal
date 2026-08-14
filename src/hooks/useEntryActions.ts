import { useCallback, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { useToast } from '../components/ToastContext'
import type { Entry } from '../db/models'

/**
 * The one delete flow for every page: confirm dialog state + soft delete +
 * undo toast, with re-entry and error guards (the strictest behavior,
 * previously hand-rolled per page).
 */
export function useEntryActions() {
  const deleteEntry = useEntryStore((state) => state.deleteEntry)
  const restoreEntry = useEntryStore((state) => state.restoreEntry)
  const { showToast } = useToast()
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null)
  const busyRef = useRef(false)

  const requestDelete = useCallback((entry: Entry) => setDeletingEntry(entry), [])
  const cancelDelete = useCallback(() => setDeletingEntry(null), [])

  const confirmDelete = useCallback(async () => {
    const entry = deletingEntry
    if (!entry || busyRef.current) return
    busyRef.current = true
    try {
      await deleteEntry(entry.id)
      setDeletingEntry(null)
      showToast('已移入回收站', 'success', {
        label: '撤销',
        action: async () => {
          try {
            await restoreEntry(entry.id)
          } catch {
            showToast('恢复失败', 'error')
          }
        },
      })
    } catch {
      showToast('删除失败，请重试', 'error')
    } finally {
      busyRef.current = false
    }
  }, [deletingEntry, deleteEntry, restoreEntry, showToast])

  return { deletingEntry, requestDelete, cancelDelete, confirmDelete }
}
