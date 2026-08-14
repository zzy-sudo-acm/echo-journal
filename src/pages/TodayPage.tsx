import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEntryStore } from '../store/entryStore'
import { useTimelineEntries, useHasEarlierEntries } from '../db/live'
import { useEntryActions } from '../hooks/useEntryActions'
import { QuickInput } from '../components/QuickInput'
import { OPEN_FULL_EDITOR_EVENT, consumeFullEditorOpenRequest } from '../utils/events'
import { TimelineIntro } from '../components/TimelineIntro'
import { TimelineDayGroup, type TimelineDayVariant } from '../components/TimelineDayGroup'
import { LazyEntryEditor } from '../components/LazyEntryEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/ToastContext'
import { formatLocalDateString, getLocalDateString, parseLocalDateString, toLocalDate } from '../utils/date'
import type { Entry, CreateEntryInput } from '../db/models'

const PAGE_DAYS = 14
const TIMELINE_SCROLL_KEY = 'echo-journal:scroll-timeline'

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
  const today = useEntryStore((state) => state.todayDate)
  const createEntry = useEntryStore((state) => state.createEntry)
  const updateEntry = useEntryStore((state) => state.updateEntry)
  const [dayCount, setDayCount] = useState(PAGE_DAYS)
  const entries = useTimelineEntries(dayCount)
  const hasEarlier = useHasEarlierEntries(dayCount)
  const [creatingEntry, setCreatingEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const { deletingEntry, requestDelete, cancelDelete, confirmDelete } = useEntryActions()
  const { showToast } = useToast()
  const positioned = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prependAnchor = useRef<{ prevHeight: number } | null>(null)

  const loadEarlier = useCallback(() => {
    // Keep the viewport steady while older days are prepended above.
    prependAnchor.current = { prevHeight: document.documentElement.scrollHeight }
    setDayCount((count) => count + PAGE_DAYS)
  }, [])

  useLayoutEffect(() => {
    const anchor = prependAnchor.current
    if (!anchor) return
    prependAnchor.current = null
    const delta = document.documentElement.scrollHeight - anchor.prevHeight
    if (delta > 0) window.scrollBy(0, delta)
  }, [entries])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasEarlier) return
    const observer = new IntersectionObserver((observed) => {
      if (observed.some((entry) => entry.isIntersecting)) loadEarlier()
    }, { rootMargin: '600px 0px 0px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasEarlier, loadEarlier])

  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = getLocalDateString(yesterdayDate)

  const groups = useMemo(() => {
    const grouped = new Map<string, Entry[]>()
    for (const entry of entries ?? []) {
      const date = toLocalDate(entry.createdAt)
      const list = grouped.get(date)
      if (list) list.push(entry)
      else grouped.set(date, [entry])
    }
    const todayEntries = grouped.get(today) ?? []
    const earlierGroups = [...grouped.entries()]
      .filter(([date]) => date !== today)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))

    return [...earlierGroups, [today, todayEntries] as const]
  }, [entries, today])

  useEffect(() => {
    const openFullEditor = () => {
      consumeFullEditorOpenRequest()
      setCreatingEntry(true)
    }
    // Catch open requests issued before this page mounted (cross-page navigation).
    if (consumeFullEditorOpenRequest()) setCreatingEntry(true)
    window.addEventListener(OPEN_FULL_EDITOR_EVENT, openFullEditor)
    return () => window.removeEventListener(OPEN_FULL_EDITOR_EVENT, openFullEditor)
  }, [])

  // Remember the timeline scroll position when leaving for another tab.
  useEffect(() => {
    return () => {
      sessionStorage.setItem(TIMELINE_SCROLL_KEY, String(window.scrollY))
    }
  }, [])

  useEffect(() => {
    if (positioned.current || entries === undefined) return
    positioned.current = true
    requestAnimationFrame(() => {
      const savedScroll = sessionStorage.getItem(TIMELINE_SCROLL_KEY)
      if (savedScroll !== null) {
        sessionStorage.removeItem(TIMELINE_SCROLL_KEY)
        window.scrollTo(0, Number(savedScroll))
        return
      }
      document.getElementById(`day-${getLocalDateString()}`)?.scrollIntoView({ block: 'start' })
    })
  }, [entries])

  const handleUpdate = async (input: CreateEntryInput) => {
    if (!editingEntry) return
    await updateEntry(editingEntry.id, input)
    showToast('日记已更新', 'success')
  }

  const handleCreate = async (input: CreateEntryInput) => {
    await createEntry(input, { clearDraft: false })
    showToast('日记已记下', 'success')
  }

  return (
    <main className="page timeline-page">
      <TimelineIntro />

      <div className="timeline" aria-label="日记时间流">
        {hasEarlier ? (
          <div ref={sentinelRef} className="timeline-earlier">
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadEarlier}>
              加载更早的日记
            </button>
          </div>
        ) : null}

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
              onDelete={requestDelete}
              onCopied={() => showToast('已复制到剪贴板', 'success')}
            >
              {variant === 'today' ? <QuickInput /> : null}
            </TimelineDayGroup>
          )
        })}
      </div>

      {editingEntry ? (
        <LazyEntryEditor entry={editingEntry} onSave={handleUpdate} onClose={() => setEditingEntry(null)} />
      ) : null}

      {creatingEntry ? (
        <LazyEntryEditor onSave={handleCreate} onClose={() => setCreatingEntry(false)} />
      ) : null}

      {deletingEntry ? (
        <ConfirmDialog message="确定要删除这条日记吗？删除后可前往回收站恢复。" confirmLabel="删除" danger onConfirm={() => void confirmDelete()} onCancel={cancelDelete} />
      ) : null}
    </main>
  )
}
