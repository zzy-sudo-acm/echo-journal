import { ChevronLeftIcon, ChevronRightIcon } from './Icons'
import { getLocalDateString } from '../utils/date'

interface CalendarProps {
  year: number
  month: number
  datesWithEntries: Set<string>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  rangeStart?: string | null
  rangeEnd?: string | null
  selectable?: boolean
}

const DAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六']

export function Calendar({
  year,
  month,
  datesWithEntries,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  rangeStart = null,
  rangeEnd = null,
  selectable = true,
}: CalendarProps) {
  const today = getLocalDateString()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const cells: Array<{ day: number; date: string | null; current: boolean }> = []

  for (let index = firstDayOfWeek - 1; index >= 0; index--) cells.push({ day: prevMonthDays - index, date: null, current: false })
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, current: true })
  }
  for (let day = 1; cells.length < 42; day++) cells.push({ day, date: null, current: false })

  return (
    <section className="calendar" aria-label={`${year} 年 ${month + 1} 月日历`}>
      <div className="calendar-header">
        <button type="button" className="icon-button" aria-label="上个月" onClick={onPrevMonth}><ChevronLeftIcon /></button>
        <h2>{year} 年 {month + 1} 月</h2>
        <button type="button" className="icon-button" aria-label="下个月" onClick={onNextMonth}><ChevronRightIcon /></button>
      </div>
      <div className="calendar-grid">
        {DAY_HEADERS.map((day) => <div key={day} className="calendar-day-header">{day}</div>)}
        {cells.map((cell, index) => {
          const isToday = cell.date === today
          const isSelected = cell.date === selectedDate
          const isRangeEdge = cell.date !== null && (cell.date === rangeStart || cell.date === rangeEnd)
          const isInRange = cell.date !== null && rangeStart !== null && rangeEnd !== null && cell.date >= rangeStart && cell.date <= rangeEnd
          const hasEntries = cell.date ? datesWithEntries.has(cell.date) : false
          return (
            <button
              type="button"
              key={`${cell.day}-${index}`}
              className={`calendar-day ${cell.current ? '' : 'other-month'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isInRange ? 'in-range' : ''} ${isRangeEdge ? 'range-edge' : ''} ${hasEntries ? 'has-entries' : ''}`}
              disabled={!cell.current || !cell.date || !selectable}
              aria-pressed={isSelected}
              aria-label={cell.date ? `${month + 1} 月 ${cell.day} 日${hasEntries ? '，有日记' : ''}` : undefined}
              onClick={() => { if (cell.date) onSelectDate(cell.date) }}
            >{cell.day}</button>
          )
        })}
      </div>
    </section>
  )
}
