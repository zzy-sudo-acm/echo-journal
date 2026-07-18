import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

interface CalendarProps {
  year: number
  month: number // 0-indexed
  datesWithEntries: Set<string>
  selectedDate: string | null
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
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
}: CalendarProps) {
  const today = new Date().toISOString().slice(0, 10)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const prevMonthDays = new Date(year, month, 0).getDate()
  const prevMonthCells: { day: number; type: 'prev' }[] = []
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthCells.push({ day: prevMonthDays - i, type: 'prev' })
  }

  const currentMonthCells: { day: number; type: 'current'; date: string }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    currentMonthCells.push({ day: d, type: 'current', date })
  }

  const totalCells = prevMonthCells.length + currentMonthCells.length
  const nextMonthCells: { day: number; type: 'next' }[] = []
  for (let i = 1; nextMonthCells.length + totalCells < 42; i++) {
    nextMonthCells.push({ day: i, type: 'next' })
  }

  const allCells = [...prevMonthCells, ...currentMonthCells, ...nextMonthCells]

  return (
    <div>
      <div className="calendar-header">
        <button className="btn btn-ghost" onClick={onPrevMonth}>
          <ChevronLeftIcon />
        </button>
        <h2>
          {year}年{month + 1}月
        </h2>
        <button className="btn btn-ghost" onClick={onNextMonth}>
          <ChevronRightIcon />
        </button>
      </div>

      <div className="calendar-grid">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="calendar-day-header">
            {d}
          </div>
        ))}

        {allCells.map((cell, i) => {
          const date = cell.type === 'current' ? (cell as typeof currentMonthCells[0]).date : null
          const isToday = date === today
          const isSelected = date === selectedDate
          const hasEntries = date ? datesWithEntries.has(date) : false

          return (
            <div
              key={i}
              className={`calendar-day ${cell.type !== 'current' ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEntries ? 'has-entries' : ''}`}
              onClick={() => {
                if (cell.type === 'current' && date) {
                  onSelectDate(date)
                }
              }}
            >
              {cell.day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
