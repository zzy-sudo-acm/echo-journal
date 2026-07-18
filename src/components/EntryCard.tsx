import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../db/models'
import { CopyIcon, EditIcon, MoreIcon, TrashIcon, XIcon } from './Icons'

interface EntryCardProps {
  entry: Entry
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onCopied?: () => void
}

const LONG_ENTRY_LENGTH = 320
const LONG_PRESS_MS = 480
const MOVE_THRESHOLD = 10

export function EntryCard({ entry, onEdit, onDelete, onCopied }: EntryCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const isLong = entry.content.length > LONG_ENTRY_LENGTH

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearLongPressTimer()
  }, [])

  const startLongPress = (clientX: number, clientY: number) => {
    touchStart.current = { x: clientX, y: clientY }
    clearLongPressTimer()
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      setShowActions(true)
    }, LONG_PRESS_MS)
  }

  const checkLongPressMove = (clientX: number, clientY: number) => {
    if (!touchStart.current || !longPressTimer.current) return
    const dx = Math.abs(clientX - touchStart.current.x)
    const dy = Math.abs(clientY - touchStart.current.y)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearLongPressTimer()
    }
  }

  const cancelLongPress = () => {
    touchStart.current = null
    clearLongPressTimer()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.content)
    setShowActions(false)
    onCopied?.()
  }

  return (
    <article
      className="entry-row"
      tabIndex={0}
      aria-label={`${time} 的日记，点击显示操作`}
      onClick={() => setShowActions(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setShowActions(true)
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0]
        startLongPress(touch.clientX, touch.clientY)
      }}
      onTouchMove={(event) => {
        const touch = event.touches[0]
        checkLongPressMove(touch.clientX, touch.clientY)
      }}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onContextMenu={(event) => {
        event.preventDefault()
        setShowActions(true)
      }}
    >
      <div className="entry-time">{time}</div>
      <div className="entry-main">
        {entry.title ? <h3 className="entry-title">{entry.title}</h3> : null}
        <div className={`entry-content ${isLong && !expanded ? 'is-collapsed' : ''}`}>
          {entry.content}
        </div>
        {isLong ? (
          <button
            type="button"
            className="entry-expand"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((value) => !value)
            }}
          >
            {expanded ? '收起' : '展开全文'}
          </button>
        ) : null}
        {entry.tags.length > 0 ? (
          <div className="entry-tags" aria-label="标签">
            {entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
        ) : null}
      </div>
      <MoreIcon className="entry-more" />

      {showActions ? (
        <div className="entry-action-overlay" onClick={(event) => { event.stopPropagation(); setShowActions(false) }}>
          <div className="entry-action-sheet" role="dialog" aria-modal="true" aria-label="日记操作" onClick={(event) => event.stopPropagation()}>
            <div className="action-sheet-header">
              <span>{time}</span>
              <button type="button" className="icon-button" aria-label="关闭操作菜单" onClick={() => setShowActions(false)}><XIcon /></button>
            </div>
            <div className="action-sheet-actions">
              <button type="button" onClick={handleCopy}><CopyIcon /><span>复制</span></button>
              <button type="button" onClick={() => { setShowActions(false); onEdit(entry) }}><EditIcon /><span>编辑与时间</span></button>
              <button type="button" className="danger-action" onClick={() => { setShowActions(false); onDelete(entry) }}><TrashIcon /><span>删除</span></button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}