import type { ReactNode } from 'react'
import type { Entry } from '../db/models'
import { EntryCard } from './EntryCard'

export type TimelineDayVariant = 'today' | 'yesterday' | 'older'

interface TimelineDayGroupProps {
  date: string
  label: string
  variant: TimelineDayVariant
  entries: Entry[]
  children?: ReactNode
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  onCopied: () => void
}

export function TimelineDayGroup({
  date,
  label,
  variant,
  entries,
  children,
  onEdit,
  onDelete,
  onCopied,
}: TimelineDayGroupProps) {
  const headingId = `day-heading-${date}`

  return (
    <section
      className={`day-group timeline-day-card timeline-day-card--${variant} ${entries.length ? 'has-entries' : 'is-empty'}`}
      id={`day-${date}`}
      aria-labelledby={headingId}
    >
      <header className="timeline-day-header">
        <h2 id={headingId}>{label}</h2>
      </header>

      {entries.length ? (
        <div className="day-entries">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopied={onCopied}
            />
          ))}
        </div>
      ) : null}

      {children ? <div className="timeline-day-composer">{children}</div> : null}
    </section>
  )
}
