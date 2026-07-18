import { useEffect } from 'react'
import { useEntryStore } from '../store/entryStore'
import { ClockIcon } from './Icons'
import type { Entry } from '../db/models'

interface OnThisDayProps {
  onEntryClick: (entry: Entry) => void
}

export function OnThisDay({ onEntryClick }: OnThisDayProps) {
  const { onThisDayEntries, loadOnThisDay } = useEntryStore()

  const today = new Date()
  const month = today.getMonth()
  const day = today.getDate()

  useEffect(() => {
    loadOnThisDay(month, day)
  }, [loadOnThisDay, month, day])

  // Filter out today's entries
  const todayStr = today.toISOString().slice(0, 10)
  const pastEntries = onThisDayEntries.filter((e) => !e.createdAt.startsWith(todayStr))

  if (pastEntries.length === 0) return null

  return (
    <div className="on-this-day">
      <div className="on-this-day-header">
        <ClockIcon />
        <h3>过去的今天</h3>
      </div>

      {pastEntries.slice(0, 5).map((entry) => {
        const entryDate = new Date(entry.createdAt)
        const year = entryDate.getFullYear()
        const time = entryDate.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div
            key={entry.id}
            className="entry-card"
            onClick={() => onEntryClick(entry)}
            style={{ cursor: 'pointer' }}
          >
            <div className="entry-time">
              {year}年 · {time}
            </div>
            {entry.title && <div className="entry-title">{entry.title}</div>}
            <div className="entry-content">
              {entry.content.length > 120
                ? entry.content.slice(0, 120) + '…'
                : entry.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
