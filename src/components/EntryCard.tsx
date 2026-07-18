import { useRef, useState } from 'react'
import type { Entry } from '../db/models'
import { CopyIcon, EditIcon, MoreIcon, TrashIcon, XIcon } from './Icons'

interface EntryCardProps {
  entry: Entry
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onCopied?: () => void
}

const LONG_ENTRY_LENGTH = 320

export function EntryCard({ entry, onEdit, onDelete, onCopied }: EntryCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const isLong = entry.content.length > LONG_ENTRY_LENGTH

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => setShowActions(true), 480)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
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
      onTouchStart={startLongPress}
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
