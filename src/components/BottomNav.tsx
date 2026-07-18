import { useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { HomeIcon, CalendarIcon, SearchIcon, SettingsIcon } from './Icons'

const navItems = [
  { to: '/', icon: HomeIcon, label: '此刻', motion: 'home' },
  { to: '/calendar', icon: CalendarIcon, label: '日历', motion: 'calendar' },
  { to: '/search', icon: SearchIcon, label: '搜索', motion: 'search' },
  { to: '/settings', icon: SettingsIcon, label: '设置', motion: 'settings' },
]

function getActiveIndex(pathname: string) {
  if (pathname === '/review') return 3
  const index = navItems.findIndex((item) => item.to === pathname)
  return index >= 0 ? index : 0
}

export function BottomNav() {
  const { pathname } = useLocation()
  const activeIndex = getActiveIndex(pathname)
  const feedbackSequence = useRef(0)
  const [iconFeedback, setIconFeedback] = useState<{ path: string; sequence: number } | null>(null)

  return (
    <nav className="bottom-nav" aria-label="主要导航">
      <span
        className="bottom-nav-indicator"
        style={{ transform: `translate3d(${activeIndex * 100}%, 0, 0)` }}
        aria-hidden="true"
      >
        <span className="bottom-nav-indicator-surface" key={activeIndex} />
      </span>
      {navItems.map(({ to, icon: Icon, label, motion }) => {
        const feedbackActive = iconFeedback?.path === to

        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => {
              if (pathname === to) return
              feedbackSequence.current += 1
              setIconFeedback({ path: to, sequence: feedbackSequence.current })
            }}
          >
            <span
              key={feedbackActive ? iconFeedback?.sequence ?? 0 : 0}
              className={`bottom-nav-icon bottom-nav-icon--${motion} ${feedbackActive ? 'is-animating' : ''}`}
            >
              <Icon />
            </span>
            <span className="bottom-nav-label">{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
