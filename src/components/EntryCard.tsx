import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, TouchEvent } from 'react'
import type { Entry } from '../db/models'
import { CopyIcon, EditIcon, MoreIcon, TrashIcon, XIcon } from './Icons'
import { JournalRenderer } from './rich-text/JournalRenderer'
import { OverlayBase } from './ui/Overlay'

interface EntryCardProps {
  entry: Entry
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onCopied?: () => void
}

const LONG_ENTRY_LENGTH = 320
const LONG_PRESS_MS = 480
const MOVE_THRESHOLD = 10

/**
 * Copy with a legacy fallback: the async clipboard API rejects in insecure
 * contexts, so fall back to a temporary textarea + execCommand. Returns
 * whether the copy succeeded so callers only toast on real success.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const helper = document.createElement('textarea')
    helper.value = text
    helper.setAttribute('readonly', '')
    helper.style.position = 'fixed'
    helper.style.top = '-9999px'
    document.body.appendChild(helper)
    helper.select()
    const copied = document.execCommand('copy')
    helper.remove()
    return copied
  } catch {
    return false
  }
}

export const EntryCard = memo(function EntryCard({ entry, onEdit, onDelete, onCopied }: EntryCardProps) {
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
  const showRichContent = Boolean(entry.richContent) && (!isLong || expanded)

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearLongPressTimer()
  }, [clearLongPressTimer])

  const closeActions = useCallback(() => setShowActions(false), [])

  const startLongPress = useCallback((clientX: number, clientY: number) => {
    touchStart.current = { x: clientX, y: clientY }
    clearLongPressTimer()
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      setShowActions(true)
    }, LONG_PRESS_MS)
  }, [clearLongPressTimer])

  const checkLongPressMove = useCallback((clientX: number, clientY: number) => {
    if (!touchStart.current || !longPressTimer.current) return
    const dx = Math.abs(clientX - touchStart.current.x)
    const dy = Math.abs(clientY - touchStart.current.y)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearLongPressTimer()
    }
  }, [clearLongPressTimer])

  const cancelLongPress = useCallback(() => {
    touchStart.current = null
    clearLongPressTimer()
  }, [clearLongPressTimer])

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    startLongPress(touch.clientX, touch.clientY)
  }, [startLongPress])

  const handleTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0]
    checkLongPressMove(touch.clientX, touch.clientY)
  }, [checkLongPressMove])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault()
    setShowActions(true)
  }, [])

  const handleCopy = useCallback(async () => {
    const copied = await copyText(entry.content)
    setShowActions(false)
    if (copied) onCopied?.()
  }, [entry.content, onCopied])

  const handleEdit = useCallback(() => {
    setShowActions(false)
    onEdit(entry)
  }, [entry, onEdit])

  const handleDelete = useCallback(() => {
    setShowActions(false)
    onDelete(entry)
  }, [entry, onDelete])

  // Single click on a collapsible card toggles the fold; it must not fire
  // while the user is selecting text or dismissing the action sheet (the
  // sheet lives in a portal, so its backdrop clicks still bubble here).
  const toggleExpanded = useCallback(() => {
    if (showActions) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
    setExpanded((value) => !value)
  }, [showActions])

  const handleExpandKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setExpanded((value) => !value)
    }
  }, [])

  const handleExpandButtonClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setExpanded((value) => !value)
  }, [])

  const handleMoreClick = useCallback((event: MouseEvent<SVGSVGElement>) => {
    event.stopPropagation()
    setShowActions(true)
  }, [])

  const handleMoreKeyDown = useCallback((event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      setShowActions(true)
    }
  }, [])

  return (
    <article
      className="entry-row"
      {...(isLong
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-expanded': expanded,
            'aria-label': `${time} 的日记，点击${expanded ? '收起' : '展开全文'}`,
            onClick: toggleExpanded,
            onKeyDown: handleExpandKeyDown,
          }
        : {})}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onContextMenu={handleContextMenu}
    >
      <div className="entry-time">{time}</div>
      <div className="entry-main">
        {entry.title ? <h3 className="entry-title">{entry.title}</h3> : null}
        <div className={`entry-content ${showRichContent ? 'has-rich-content' : ''} ${isLong && !expanded ? 'is-collapsed' : ''}`}>
          {showRichContent && entry.richContent ? (
            <JournalRenderer content={entry.richContent} />
          ) : (
            entry.content
          )}
        </div>
        {isLong ? (
          <button
            type="button"
            className="entry-expand"
            onClick={handleExpandButtonClick}
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
      <MoreIcon
        className="entry-more"
        role="button"
        tabIndex={0}
        aria-label="更多操作"
        aria-hidden={false}
        onClick={handleMoreClick}
        onKeyDown={handleMoreKeyDown}
      />

      {showActions ? (
        <OverlayBase
          onClose={closeActions}
          overlayClassName="entry-action-overlay"
          panelClassName="entry-action-sheet"
          ariaLabel="日记操作"
        >
          <div className="action-sheet-header">
            <span>{time}</span>
            <button type="button" className="icon-button" aria-label="关闭操作菜单" onClick={closeActions}><XIcon /></button>
          </div>
          <div className="action-sheet-actions">
            <button type="button" onClick={handleCopy}><CopyIcon /><span>复制</span></button>
            <button type="button" onClick={handleEdit}><EditIcon /><span>编辑与时间</span></button>
            <button type="button" className="danger-action" onClick={handleDelete}><TrashIcon /><span>删除</span></button>
          </div>
        </OverlayBase>
      ) : null}
    </article>
  )
})
