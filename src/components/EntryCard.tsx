import { useState } from 'react'
import type { Entry } from '../db/models'
import { TrashIcon, EditIcon } from './Icons'

interface EntryCardProps {
  entry: Entry
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
}

export function EntryCard({ entry, onEdit, onDelete }: EntryCardProps) {
  const [showActions, setShowActions] = useState(false)

  const time = new Date(entry.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      className="entry-card"
      onClick={() => setShowActions(!showActions)}
    >
      <div className="entry-time">{time}</div>
      {entry.title && <div className="entry-title">{entry.title}</div>}
      <div className="entry-content">
        {entry.content.length > 300 && !showActions
          ? entry.content.slice(0, 300) + '…'
          : entry.content}
      </div>
      {entry.tags.length > 0 && (
        <div className="entry-tags">
          {entry.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
      {showActions && (
        <div className="entry-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => onEdit(entry)}>
            <EditIcon /> 编辑
          </button>
          <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => onDelete(entry)}>
            <TrashIcon /> 删除
          </button>
        </div>
      )}
    </div>
  )
}
