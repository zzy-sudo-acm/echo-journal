import { useEffect, useState } from 'react'

type DayPeriod = 'lateNight' | 'morning' | 'afternoon' | 'evening'

const periodCopy: Record<DayPeriod, string> = {
  lateNight: '夜还很深，心事可以慢一点写。',
  morning: '天光落下来，今天还没有定稿。',
  afternoon: '此刻，正慢慢成为往事。',
  evening: '白昼退去，文字替你留下。',
}

function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours()

  if (hour < 5) return 'lateNight'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function getMillisecondsUntilNextPeriod(date: Date) {
  const next = new Date(date)
  const hour = date.getHours()
  const nextHour = hour < 5 ? 5 : hour < 12 ? 12 : hour < 18 ? 18 : 24

  next.setHours(nextHour, 0, 0, 0)
  return Math.max(1_000, next.getTime() - date.getTime())
}

function formatIntroDate(date: Date) {
  const localDate = date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const weekday = date.toLocaleDateString('zh-CN', { weekday: 'long' })

  return `${localDate} · ${weekday}`
}

export function TimelineIntro() {
  const [now, setNow] = useState(() => new Date())
  const period = getDayPeriod(now)

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setNow(new Date()),
      getMillisecondsUntilNextPeriod(now) + 50,
    )

    return () => window.clearTimeout(timeout)
  }, [now])

  return (
    <div className="timeline-intro">
      <p className="timeline-intro-copy">{periodCopy[period]}</p>
      <div className="timeline-intro-meta">
        <time>{formatIntroDate(now)}</time>
        <span className="timeline-intro-line" aria-hidden="true" />
      </div>
    </div>
  )
}
