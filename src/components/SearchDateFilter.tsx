import { useState } from 'react'
import { Calendar } from './Calendar'
import { XIcon } from './Icons'
import {
  NO_DATE_FILTER,
  formatSearchDateFilter,
  type SearchDateFilter,
} from '../services/search'
import { getLocalDateString, parseLocalDateString } from '../utils/date'

interface SearchDateFilterProps {
  value: SearchDateFilter
  datesWithEntries: Set<string>
  onApply: (filter: SearchDateFilter) => void
  onClose: () => void
}

function initialView(filter: SearchDateFilter): { year: number; month: number } {
  if (filter.mode === 'month') return { year: filter.year, month: filter.month }
  const date = filter.mode === 'day'
    ? filter.date
    : filter.mode === 'range'
      ? filter.start
      : getLocalDateString()
  const parsed = parseLocalDateString(date)
  return { year: parsed.getFullYear(), month: parsed.getMonth() }
}

export function SearchDateFilterPanel({
  value,
  datesWithEntries,
  onApply,
  onClose,
}: SearchDateFilterProps) {
  const initial = initialView(value)
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [draft, setDraft] = useState<SearchDateFilter>(value)

  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
    if (draft.mode === 'month') {
      setDraft({ mode: 'month', year: next.getFullYear(), month: next.getMonth() })
    }
  }

  const selectMode = (mode: SearchDateFilter['mode']) => {
    if (mode === 'all') {
      setDraft(NO_DATE_FILTER)
      return
    }
    if (mode === 'day') {
      const date = draft.mode === 'day' ? draft.date : getLocalDateString()
      setDraft({ mode: 'day', date })
      const parsed = parseLocalDateString(date)
      setYear(parsed.getFullYear())
      setMonth(parsed.getMonth())
      return
    }
    if (mode === 'month') {
      setDraft({ mode: 'month', year, month })
      return
    }
    setDraft(draft.mode === 'range' ? draft : { mode: 'range', start: '', end: '' })
  }

  const selectDate = (date: string) => {
    if (draft.mode === 'day') {
      setDraft({ mode: 'day', date })
      return
    }
    if (draft.mode !== 'range') return
    if (!draft.start || draft.end) {
      setDraft({ mode: 'range', start: date, end: '' })
      return
    }
    setDraft(date < draft.start
      ? { mode: 'range', start: date, end: draft.start }
      : { mode: 'range', start: draft.start, end: date })
  }

  const canApply = draft.mode !== 'range' || Boolean(draft.start && draft.end)
  const draftLabel = draft.mode === 'range' && (!draft.start || !draft.end)
    ? null
    : formatSearchDateFilter(draft)

  return (
    <>
      <button type="button" className="search-date-scrim" aria-label="关闭日期筛选" onClick={onClose} />
      <section className="search-date-panel" role="dialog" aria-modal="true" aria-labelledby="search-date-title">
        <header className="search-date-header">
          <div>
            <h2 id="search-date-title">日期筛选</h2>
            <p>{draft.mode === 'range' && draft.start && !draft.end ? '再选择结束日期' : draftLabel || '不限时间'}</p>
          </div>
          <button type="button" className="icon-button" aria-label="关闭日期筛选" onClick={onClose}><XIcon /></button>
        </header>

        <div className="date-filter-modes" aria-label="日期筛选模式">
          {([
            ['all', '不限'],
            ['day', '某一天'],
            ['month', '某个月'],
            ['range', '范围'],
          ] as const).map(([mode, label]) => (
            <button
              type="button"
              key={mode}
              className={draft.mode === mode ? 'active' : ''}
              aria-pressed={draft.mode === mode}
              onClick={() => selectMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>

        {draft.mode !== 'all' ? (
          <Calendar
            year={year}
            month={month}
            datesWithEntries={datesWithEntries}
            selectedDate={draft.mode === 'day' ? draft.date : null}
            rangeStart={draft.mode === 'range' ? draft.start || null : null}
            rangeEnd={draft.mode === 'range' ? draft.end || null : null}
            selectable={draft.mode !== 'month'}
            onSelectDate={selectDate}
            onPrevMonth={() => moveMonth(-1)}
            onNextMonth={() => moveMonth(1)}
          />
        ) : (
          <p className="date-filter-all-copy">搜索全部本地日记，不限制记录日期。</p>
        )}

        <footer className="search-date-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onApply(NO_DATE_FILTER)}
            disabled={value.mode === 'all' && draft.mode === 'all'}
          >
            清除日期
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canApply}
            onClick={() => {
              if (draft.mode === 'month') {
                onApply({ mode: 'month', year, month })
                return
              }
              onApply(draft)
            }}
          >
            应用
          </button>
        </footer>
      </section>
    </>
  )
}
